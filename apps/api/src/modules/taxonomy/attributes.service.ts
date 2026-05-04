import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import {
  attributeOptions,
  attributes,
  itemAttributeValues,
} from '../../database/schema';
import type { CreateAttributeDto, UpdateAttributeDto } from './dto';

@Injectable()
export class AttributesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list() {
    const rows = await this.db
      .select({
        id: attributes.id,
        name: attributes.name,
        type: attributes.type,
        unit: attributes.unit,
        description: attributes.description,
        position: attributes.position,
        usedIn: sql<number>`count(distinct ${itemAttributeValues.itemId})::int`,
      })
      .from(attributes)
      .leftJoin(itemAttributeValues, eq(itemAttributeValues.attributeId, attributes.id))
      .groupBy(attributes.id)
      .orderBy(asc(attributes.position), asc(attributes.name));

    const allOptions = await this.db
      .select()
      .from(attributeOptions)
      .orderBy(asc(attributeOptions.position), asc(attributeOptions.value));

    return rows.map((r) => ({
      ...r,
      usedIn: Number(r.usedIn),
      options: allOptions.filter((o) => o.attributeId === r.id),
    }));
  }

  async findOne(id: string) {
    const row = await this.db.query.attributes.findFirst({
      where: eq(attributes.id, id),
    });
    if (!row) throw new NotFoundException(`attribute ${id} not found`);
    const options = await this.db
      .select()
      .from(attributeOptions)
      .where(eq(attributeOptions.attributeId, id))
      .orderBy(asc(attributeOptions.position), asc(attributeOptions.value));
    return { ...row, options };
  }

  async create(dto: CreateAttributeDto) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(attributes)
        .values({
          name: dto.name,
          type: dto.type,
          unit: dto.unit,
          description: dto.description,
          position: 0,
        })
        .returning();
      if (!row) throw new Error('failed to create attribute');

      const opts = (dto.options ?? []).map((value, idx) => ({
        attributeId: row.id,
        value,
        position: idx,
      }));
      const insertedOptions = opts.length
        ? await tx.insert(attributeOptions).values(opts).returning()
        : [];
      return { ...row, options: insertedOptions, usedIn: 0 };
    });
  }

  async update(id: string, dto: UpdateAttributeDto) {
    const existing = await this.db.query.attributes.findFirst({ where: eq(attributes.id, id) });
    if (!existing) throw new NotFoundException(`attribute ${id} not found`);

    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(attributes)
        .set({
          name: dto.name ?? existing.name,
          unit: dto.unit === undefined ? existing.unit : dto.unit,
          description: dto.description === undefined ? existing.description : dto.description,
          updatedAt: new Date(),
        })
        .where(eq(attributes.id, id))
        .returning();
      if (!row) throw new NotFoundException(`attribute ${id} not found`);

      if (dto.options !== undefined) {
        if (existing.type !== 'single_select' && existing.type !== 'multi_select') {
          throw new BadRequestException('options only allowed for select types');
        }
        await tx.delete(attributeOptions).where(eq(attributeOptions.attributeId, id));
        if (dto.options.length) {
          await tx.insert(attributeOptions).values(
            dto.options.map((value, idx) => ({
              attributeId: id,
              value,
              position: idx,
            })),
          );
        }
      }

      const options = await tx
        .select()
        .from(attributeOptions)
        .where(eq(attributeOptions.attributeId, id))
        .orderBy(asc(attributeOptions.position), asc(attributeOptions.value));
      return { ...row, options };
    });
  }

  async delete(id: string) {
    const [row] = await this.db.delete(attributes).where(eq(attributes.id, id)).returning();
    if (!row) throw new NotFoundException(`attribute ${id} not found`);
    return { ok: true as const };
  }
}
