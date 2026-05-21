import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateCategoryDto,
  CreateMicrocategoryDto,
  CreateSubcategoryDto,
  UpdateCategoryDto,
  UpdateMicrocategoryDto,
  UpdateSubcategoryDto,
} from './dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listWithCounts() {
    const rows = await this.prisma.category.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: {
        subcategories: {
          orderBy: [{ position: 'asc' }, { name: 'asc' }],
          include: {
            microcategories: {
              orderBy: [{ position: 'asc' }, { name: 'asc' }],
            },
          },
        },
      },
    });

    return rows.map((cat) => ({
      id: cat.id,
      name: cat.name,
      position: cat.position,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
      subcategories: cat.subcategories.map((s) => ({
        id: s.id,
        name: s.name,
        position: s.position,
        microcategories: s.microcategories.map((m) => ({
          id: m.id,
          name: m.name,
          position: m.position,
        })),
      })),
    }));
  }

  async createCategory(dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: { name: dto.name, position: 0 } });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    try {
      return await this.prisma.category.update({ where: { id }, data: dto });
    } catch {
      throw new NotFoundException(`category ${id} not found`);
    }
  }

  async deleteCategory(id: string) {
    try {
      await this.prisma.category.delete({ where: { id } });
    } catch {
      throw new NotFoundException(`category ${id} not found`);
    }
    return { ok: true as const };
  }

  async createSubcategory(dto: CreateSubcategoryDto) {
    return this.prisma.subcategory.create({
      data: { categoryId: dto.categoryId, name: dto.name, position: 0 },
    });
  }

  async updateSubcategory(id: string, dto: UpdateSubcategoryDto) {
    try {
      return await this.prisma.subcategory.update({ where: { id }, data: dto });
    } catch {
      throw new NotFoundException(`subcategory ${id} not found`);
    }
  }

  async deleteSubcategory(id: string) {
    try {
      await this.prisma.subcategory.delete({ where: { id } });
    } catch {
      throw new NotFoundException(`subcategory ${id} not found`);
    }
    return { ok: true as const };
  }

  async createMicrocategory(dto: CreateMicrocategoryDto) {
    return this.prisma.microcategory.create({
      data: { subcategoryId: dto.subcategoryId, name: dto.name, position: 0 },
    });
  }

  async updateMicrocategory(id: string, dto: UpdateMicrocategoryDto) {
    try {
      return await this.prisma.microcategory.update({ where: { id }, data: dto });
    } catch {
      throw new NotFoundException(`microcategory ${id} not found`);
    }
  }

  async deleteMicrocategory(id: string) {
    try {
      await this.prisma.microcategory.delete({ where: { id } });
    } catch {
      throw new NotFoundException(`microcategory ${id} not found`);
    }
    return { ok: true as const };
  }

  // Suggests attribute-library entries that have been used on lots in this
  // microcategory before, ranked by usage. Powers the "common attributes"
  // picker on the lot edit form.
  async suggestedAttributes(microcategoryId: string) {
    const total = await this.prisma.lot.count({ where: { microcategoryId } });
    const grouped = await this.prisma.lotAttributeValue.groupBy({
      by: ['attributeId'],
      where: {
        attributeId: { not: null },
        lot: { microcategoryId },
      },
      _count: { lotId: true },
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
        return { ...attr, used: g._count.lotId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.used - a.used);

    return { total, attributes: sorted };
  }
}
