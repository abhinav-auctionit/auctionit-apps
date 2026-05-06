import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateCategoryDto,
  CreateSubcategoryDto,
  UpdateCategoryDto,
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
          include: { _count: { select: { items: true } } },
        },
      },
    });

    return rows.map((cat) => {
      const subcategories = cat.subcategories.map((s) => ({
        id: s.id,
        name: s.name,
        position: s.position,
        itemCount: s._count.items,
      }));
      const itemCount = subcategories.reduce((acc, s) => acc + s.itemCount, 0);
      return {
        id: cat.id,
        name: cat.name,
        position: cat.position,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
        itemCount,
        subcategories,
      };
    });
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
}
