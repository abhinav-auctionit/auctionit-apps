import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { categories, items, subcategories } from '../../database/schema';
import type {
  CreateCategoryDto,
  CreateSubcategoryDto,
  UpdateCategoryDto,
  UpdateSubcategoryDto,
} from './dto';

@Injectable()
export class CategoriesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listWithCounts() {
    const rows = await this.db
      .select({
        id: categories.id,
        name: categories.name,
        position: categories.position,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
      })
      .from(categories)
      .orderBy(asc(categories.position), asc(categories.name));

    const subRows = await this.db
      .select({
        id: subcategories.id,
        categoryId: subcategories.categoryId,
        name: subcategories.name,
        position: subcategories.position,
        itemCount: sql<number>`count(${items.id})::int`,
      })
      .from(subcategories)
      .leftJoin(items, eq(items.subcategoryId, subcategories.id))
      .groupBy(subcategories.id)
      .orderBy(asc(subcategories.position), asc(subcategories.name));

    return rows.map((cat) => {
      const subs = subRows.filter((s) => s.categoryId === cat.id);
      const itemCount = subs.reduce((acc, s) => acc + Number(s.itemCount), 0);
      return {
        ...cat,
        itemCount,
        subcategories: subs.map((s) => ({
          id: s.id,
          name: s.name,
          position: s.position,
          itemCount: Number(s.itemCount),
        })),
      };
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    const [row] = await this.db
      .insert(categories)
      .values({ name: dto.name, position: 0 })
      .returning();
    if (!row) throw new Error('failed to create category');
    return row;
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const [row] = await this.db
      .update(categories)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();
    if (!row) throw new NotFoundException(`category ${id} not found`);
    return row;
  }

  async deleteCategory(id: string) {
    const [row] = await this.db.delete(categories).where(eq(categories.id, id)).returning();
    if (!row) throw new NotFoundException(`category ${id} not found`);
    return { ok: true as const };
  }

  async createSubcategory(dto: CreateSubcategoryDto) {
    const [row] = await this.db
      .insert(subcategories)
      .values({ categoryId: dto.categoryId, name: dto.name, position: 0 })
      .returning();
    if (!row) throw new Error('failed to create subcategory');
    return row;
  }

  async updateSubcategory(id: string, dto: UpdateSubcategoryDto) {
    const [row] = await this.db
      .update(subcategories)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(subcategories.id, id))
      .returning();
    if (!row) throw new NotFoundException(`subcategory ${id} not found`);
    return row;
  }

  async deleteSubcategory(id: string) {
    const [row] = await this.db.delete(subcategories).where(eq(subcategories.id, id)).returning();
    if (!row) throw new NotFoundException(`subcategory ${id} not found`);
    return { ok: true as const };
  }
}
