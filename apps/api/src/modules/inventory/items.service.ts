import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateItemDto, ItemAttributeValueInputDto, UpdateItemDto } from './dto';

const itemSelect = {
  id: true,
  name: true,
  uom: true,
  hsnCode: true,
  benchmarkCents: true,
  createdAt: true,
  updatedAt: true,
  microcategoryId: true,
  microcategory: {
    select: {
      name: true,
      subcategoryId: true,
      subcategory: {
        select: {
          name: true,
          categoryId: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
  },
  attributeValues: {
    select: {
      id: true,
      attributeId: true,
      customName: true,
      valueText: true,
      valueNumber: true,
      valueOptionIds: true,
      attribute: { select: { name: true, type: true, unit: true } },
    },
  },
} satisfies Prisma.ItemSelect;

type ItemRow = Prisma.ItemGetPayload<{ select: typeof itemSelect }>;

function flatten(row: ItemRow) {
  const { microcategory, attributeValues, ...rest } = row;
  const subcategory = microcategory.subcategory;
  return {
    ...rest,
    microcategoryName: microcategory.name,
    subcategoryId: microcategory.subcategoryId,
    subcategoryName: subcategory.name,
    categoryId: subcategory.category.id,
    categoryName: subcategory.category.name,
    attributeValues: attributeValues.map(({ attribute, ...av }) => ({
      ...av,
      valueNumber: av.valueNumber !== null ? av.valueNumber.toString() : null,
      attrName: attribute?.name ?? null,
      attrType: attribute?.type ?? null,
      attrUnit: attribute?.unit ?? null,
    })),
  };
}

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    params: { microcategoryId?: string; subcategoryId?: string; categoryId?: string } = {},
  ) {
    const where: Prisma.ItemWhereInput = params.microcategoryId
      ? { microcategoryId: params.microcategoryId }
      : params.subcategoryId
        ? { microcategory: { subcategoryId: params.subcategoryId } }
        : params.categoryId
          ? { microcategory: { subcategory: { categoryId: params.categoryId } } }
          : {};

    const rows = await this.prisma.item.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: itemSelect,
    });
    return rows.map(flatten);
  }

  async findOne(id: string) {
    const row = await this.prisma.item.findUnique({
      where: { id },
      select: itemSelect,
    });
    if (!row) throw new NotFoundException(`item ${id} not found`);
    return flatten(row);
  }

  async create(dto: CreateItemDto) {
    const created = await this.prisma.item.create({
      data: {
        microcategoryId: dto.microcategoryId,
        name: dto.name,
        uom: dto.uom,
        hsnCode: dto.hsnCode ?? null,
        benchmarkCents: dto.benchmarkCents ?? null,
      },
      select: { id: true },
    });
    return this.findOne(created.id);
  }

  async update(id: string, dto: UpdateItemDto) {
    try {
      await this.prisma.item.update({
        where: { id },
        data: {
          microcategoryId: dto.microcategoryId ?? undefined,
          name: dto.name ?? undefined,
          uom: dto.uom ?? undefined,
          hsnCode: dto.hsnCode === undefined ? undefined : dto.hsnCode,
          benchmarkCents: dto.benchmarkCents === undefined ? undefined : dto.benchmarkCents,
        },
      });
    } catch {
      throw new NotFoundException(`item ${id} not found`);
    }
    return this.findOne(id);
  }

  async delete(id: string) {
    try {
      await this.prisma.item.delete({ where: { id } });
    } catch {
      throw new NotFoundException(`item ${id} not found`);
    }
    return { ok: true as const };
  }

  async addAttributeValue(itemId: string, dto: ItemAttributeValueInputDto) {
    if (dto.attributeId) {
      const attr = await this.prisma.attribute.findUnique({
        where: { id: dto.attributeId },
        include: { options: { select: { id: true } } },
      });
      if (!attr) throw new BadRequestException('attribute not found');
      this.assertValueMatchesType(attr.type, dto);

      if (attr.type === 'single_select' || attr.type === 'multi_select') {
        const allowed = new Set(attr.options.map((o) => o.id));
        for (const oid of dto.valueOptionIds ?? []) {
          if (!allowed.has(oid)) throw new BadRequestException('invalid option id');
        }
      }
    }

    return this.prisma.itemAttributeValue.create({
      data: {
        itemId,
        attributeId: dto.attributeId ?? null,
        customName: dto.customName ?? null,
        valueText: dto.valueText ?? null,
        valueNumber: dto.valueNumber !== undefined ? dto.valueNumber : null,
        valueOptionIds: dto.valueOptionIds ?? [],
      },
    });
  }

  async removeAttributeValue(itemId: string, valueId: string) {
    const result = await this.prisma.itemAttributeValue.deleteMany({
      where: { id: valueId, itemId },
    });
    if (result.count === 0) throw new NotFoundException('value not found');
    return { ok: true as const };
  }

  async suggestedAttributes(microcategoryId: string) {
    const total = await this.prisma.item.count({ where: { microcategoryId } });
    const grouped = await this.prisma.itemAttributeValue.groupBy({
      by: ['attributeId'],
      where: {
        attributeId: { not: null },
        item: { microcategoryId },
      },
      _count: { itemId: true },
    });
    const attrIds = grouped
      .map((g) => g.attributeId)
      .filter((id): id is string => id !== null);
    const attrs = attrIds.length
      ? await this.prisma.attribute.findMany({
          where: { id: { in: attrIds } },
          select: { id: true, name: true, type: true, unit: true },
        })
      : [];

    const sorted = grouped
      .map((g) => {
        const attr = attrs.find((a) => a.id === g.attributeId);
        if (!attr) return null;
        return { ...attr, used: g._count.itemId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.used - a.used);

    return { total, attributes: sorted };
  }

  private assertValueMatchesType(type: string, dto: ItemAttributeValueInputDto) {
    if (type === 'text' && dto.valueText === undefined) {
      throw new BadRequestException('valueText required for text attribute');
    }
    if (type === 'number' && dto.valueNumber === undefined) {
      throw new BadRequestException('valueNumber required for number attribute');
    }
    if ((type === 'single_select' || type === 'multi_select') && !dto.valueOptionIds?.length) {
      throw new BadRequestException('valueOptionIds required for select attribute');
    }
    if (type === 'single_select' && (dto.valueOptionIds?.length ?? 0) !== 1) {
      throw new BadRequestException('single_select expects exactly one option');
    }
  }
}
