import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  pgEnum,
  numeric,
  text,
  unique,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { subcategories } from './subcategories';
import { attributes } from './attributes';

export const uomEnum = pgEnum('uom', ['MT', 'KG', 'NOS', 'PCS', 'LTR', 'BAG', 'CUM', 'BOX']);
export type Uom = (typeof uomEnum.enumValues)[number];

export const items = pgTable('items', {
  id: uuid().primaryKey().defaultRandom(),
  subcategoryId: uuid()
    .notNull()
    .references(() => subcategories.id, { onDelete: 'restrict' }),
  name: varchar({ length: 255 }).notNull(),
  uom: uomEnum().notNull(),
  hsnCode: varchar({ length: 8 }),
  benchmarkCents: integer(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const itemsRelations = relations(items, ({ one, many }) => ({
  subcategory: one(subcategories, { fields: [items.subcategoryId], references: [subcategories.id] }),
  attributeValues: many(itemAttributeValues),
}));

export const itemAttributeValues = pgTable(
  'item_attribute_values',
  {
    id: uuid().primaryKey().defaultRandom(),
    itemId: uuid()
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    attributeId: uuid().references(() => attributes.id, { onDelete: 'cascade' }),
    customName: varchar({ length: 255 }),
    valueText: text(),
    valueNumber: numeric({ precision: 14, scale: 4 }),
    valueOptionIds: uuid().array(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    itemAttrUnique: unique('item_attribute_values_item_id_attribute_id_unique').on(
      t.itemId,
      t.attributeId,
    ),
    libraryOrCustom: check(
      'item_attribute_values_library_or_custom',
      sql`(${t.attributeId} IS NOT NULL) <> (${t.customName} IS NOT NULL)`,
    ),
  }),
);

export const itemAttributeValuesRelations = relations(itemAttributeValues, ({ one }) => ({
  item: one(items, { fields: [itemAttributeValues.itemId], references: [items.id] }),
  attribute: one(attributes, {
    fields: [itemAttributeValues.attributeId],
    references: [attributes.id],
  }),
}));

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type ItemAttributeValue = typeof itemAttributeValues.$inferSelect;
export type NewItemAttributeValue = typeof itemAttributeValues.$inferInsert;
