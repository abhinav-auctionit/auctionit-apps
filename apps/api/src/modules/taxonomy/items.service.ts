import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import {
  attributes,
  attributeOptions,
  categories,
  itemAttributeValues,
  items,
  subcategories,
} from '../../database/schema';
import type { CreateItemDto, ItemAttributeValueInputDto, UpdateItemDto } from './dto';

@Injectable()
export class ItemsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(params: { subcategoryId?: string; categoryId?: string } = {}) {
    const where = params.subcategoryId
      ? eq(items.subcategoryId, params.subcategoryId)
      : params.categoryId
        ? eq(subcategories.categoryId, params.categoryId)
        : undefined;

    const rows = await this.db
      .select({
        id: items.id,
        name: items.name,
        uom: items.uom,
        hsnCode: items.hsnCode,
        benchmarkCents: items.benchmarkCents,
        createdAt: items.createdAt,
        subcategoryId: items.subcategoryId,
        subcategoryName: subcategories.name,
        categoryId: categories.id,
        categoryName: categories.name,
      })
      .from(items)
      .innerJoin(subcategories, eq(items.subcategoryId, subcategories.id))
      .innerJoin(categories, eq(subcategories.categoryId, categories.id))
      .where(where)
      .orderBy(desc(items.createdAt))
      .limit(500);

    const ids = rows.map((r) => r.id);
    const values = ids.length
      ? await this.db
          .select({
            itemId: itemAttributeValues.itemId,
            id: itemAttributeValues.id,
            attributeId: itemAttributeValues.attributeId,
            customName: itemAttributeValues.customName,
            valueText: itemAttributeValues.valueText,
            valueNumber: itemAttributeValues.valueNumber,
            valueOptionIds: itemAttributeValues.valueOptionIds,
            attrName: attributes.name,
            attrType: attributes.type,
            attrUnit: attributes.unit,
          })
          .from(itemAttributeValues)
          .leftJoin(attributes, eq(attributes.id, itemAttributeValues.attributeId))
          .where(sql`${itemAttributeValues.itemId} = ANY(${ids})`)
      : [];

    return rows.map((r) => ({
      ...r,
      attributeValues: values.filter((v) => v.itemId === r.id),
    }));
  }

  async findOne(id: string) {
    const row = await this.db
      .select({
        id: items.id,
        name: items.name,
        uom: items.uom,
        hsnCode: items.hsnCode,
        benchmarkCents: items.benchmarkCents,
        createdAt: items.createdAt,
        updatedAt: items.updatedAt,
        subcategoryId: items.subcategoryId,
        subcategoryName: subcategories.name,
        categoryId: categories.id,
        categoryName: categories.name,
      })
      .from(items)
      .innerJoin(subcategories, eq(items.subcategoryId, subcategories.id))
      .innerJoin(categories, eq(subcategories.categoryId, categories.id))
      .where(eq(items.id, id));

    const found = row[0];
    if (!found) throw new NotFoundException(`item ${id} not found`);

    const values = await this.db
      .select({
        id: itemAttributeValues.id,
        attributeId: itemAttributeValues.attributeId,
        customName: itemAttributeValues.customName,
        valueText: itemAttributeValues.valueText,
        valueNumber: itemAttributeValues.valueNumber,
        valueOptionIds: itemAttributeValues.valueOptionIds,
        attrName: attributes.name,
        attrType: attributes.type,
        attrUnit: attributes.unit,
      })
      .from(itemAttributeValues)
      .leftJoin(attributes, eq(attributes.id, itemAttributeValues.attributeId))
      .where(eq(itemAttributeValues.itemId, id));

    return { ...found, attributeValues: values };
  }

  async create(dto: CreateItemDto) {
    const [row] = await this.db.insert(items).values(dto).returning();
    if (!row) throw new Error('failed to create item');
    return this.findOne(row.id);
  }

  async update(id: string, dto: UpdateItemDto) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.subcategoryId !== undefined) updates.subcategoryId = dto.subcategoryId;
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.uom !== undefined) updates.uom = dto.uom;
    if (dto.hsnCode !== undefined) updates.hsnCode = dto.hsnCode;
    if (dto.benchmarkCents !== undefined) updates.benchmarkCents = dto.benchmarkCents;

    const [row] = await this.db.update(items).set(updates).where(eq(items.id, id)).returning();
    if (!row) throw new NotFoundException(`item ${id} not found`);
    return this.findOne(id);
  }

  async delete(id: string) {
    const [row] = await this.db.delete(items).where(eq(items.id, id)).returning();
    if (!row) throw new NotFoundException(`item ${id} not found`);
    return { ok: true as const };
  }

  async addAttributeValue(itemId: string, dto: ItemAttributeValueInputDto) {
    if (dto.attributeId) {
      const attr = await this.db.query.attributes.findFirst({
        where: eq(attributes.id, dto.attributeId),
      });
      if (!attr) throw new BadRequestException('attribute not found');
      this.assertValueMatchesType(attr.type, dto);

      if (attr.type === 'single_select' || attr.type === 'multi_select') {
        const opts = await this.db
          .select({ id: attributeOptions.id })
          .from(attributeOptions)
          .where(eq(attributeOptions.attributeId, attr.id));
        const allowed = new Set(opts.map((o) => o.id));
        for (const oid of dto.valueOptionIds ?? []) {
          if (!allowed.has(oid)) throw new BadRequestException('invalid option id');
        }
      }
    }

    const [row] = await this.db
      .insert(itemAttributeValues)
      .values({
        itemId,
        attributeId: dto.attributeId,
        customName: dto.customName,
        valueText: dto.valueText,
        valueNumber: dto.valueNumber !== undefined ? String(dto.valueNumber) : null,
        valueOptionIds: dto.valueOptionIds ?? null,
      })
      .returning();
    if (!row) throw new Error('failed to add attribute value');
    return row;
  }

  async removeAttributeValue(itemId: string, valueId: string) {
    const [row] = await this.db
      .delete(itemAttributeValues)
      .where(and(eq(itemAttributeValues.id, valueId), eq(itemAttributeValues.itemId, itemId)))
      .returning();
    if (!row) throw new NotFoundException('value not found');
    return { ok: true as const };
  }

  async suggestedAttributes(subcategoryId: string) {
    const totalRow = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(items)
      .where(eq(items.subcategoryId, subcategoryId));
    const total = Number(totalRow[0]?.count ?? 0);

    const rows = await this.db
      .select({
        id: attributes.id,
        name: attributes.name,
        type: attributes.type,
        unit: attributes.unit,
        used: sql<number>`count(distinct ${itemAttributeValues.itemId})::int`,
      })
      .from(itemAttributeValues)
      .innerJoin(attributes, eq(attributes.id, itemAttributeValues.attributeId))
      .innerJoin(items, eq(items.id, itemAttributeValues.itemId))
      .where(eq(items.subcategoryId, subcategoryId))
      .groupBy(attributes.id)
      .orderBy(sql`count(distinct ${itemAttributeValues.itemId}) desc`);

    return { total, attributes: rows.map((r) => ({ ...r, used: Number(r.used) })) };
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
