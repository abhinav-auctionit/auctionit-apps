import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateAttributeDto, UpdateAttributeDto } from './dto';

@Injectable()
export class AttributesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.attribute.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: {
        options: { orderBy: [{ position: 'asc' }, { value: 'asc' }] },
        _count: { select: { itemAttributeValues: true } },
      },
    });
    return rows.map(({ _count, ...attr }) => ({
      ...attr,
      usedIn: _count.itemAttributeValues,
    }));
  }

  async findOne(id: string) {
    const row = await this.prisma.attribute.findUnique({
      where: { id },
      include: { options: { orderBy: [{ position: 'asc' }, { value: 'asc' }] } },
    });
    if (!row) throw new NotFoundException(`attribute ${id} not found`);
    return row;
  }

  async create(dto: CreateAttributeDto) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.attribute.create({
        data: {
          name: dto.name,
          type: dto.type,
          unit: dto.unit ?? null,
          description: dto.description ?? null,
          position: 0,
          options: dto.options
            ? {
                create: dto.options.map((value, idx) => ({ value, position: idx })),
              }
            : undefined,
        },
        include: { options: { orderBy: [{ position: 'asc' }, { value: 'asc' }] } },
      });
      return { ...created, usedIn: 0 };
    });
  }

  async update(id: string, dto: UpdateAttributeDto) {
    const existing = await this.prisma.attribute.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`attribute ${id} not found`);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.attribute.update({
        where: { id },
        data: {
          name: dto.name ?? undefined,
          unit: dto.unit === undefined ? undefined : dto.unit,
          description: dto.description === undefined ? undefined : dto.description,
        },
      });

      if (dto.options !== undefined) {
        if (existing.type !== 'single_select' && existing.type !== 'multi_select') {
          throw new BadRequestException('options only allowed for select types');
        }
        await tx.attributeOption.deleteMany({ where: { attributeId: id } });
        if (dto.options.length) {
          await tx.attributeOption.createMany({
            data: dto.options.map((value, idx) => ({
              attributeId: id,
              value,
              position: idx,
            })),
          });
        }
      }

      const options = await tx.attributeOption.findMany({
        where: { attributeId: id },
        orderBy: [{ position: 'asc' }, { value: 'asc' }],
      });
      return { ...updated, options };
    });
  }

  async delete(id: string) {
    try {
      await this.prisma.attribute.delete({ where: { id } });
    } catch {
      throw new NotFoundException(`attribute ${id} not found`);
    }
    return { ok: true as const };
  }
}
