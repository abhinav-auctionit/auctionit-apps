import { pgTable, uuid, varchar, integer, text, timestamp, pgEnum, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const attributeTypeEnum = pgEnum('attribute_type', [
  'text',
  'number',
  'single_select',
  'multi_select',
]);
export type AttributeType = (typeof attributeTypeEnum.enumValues)[number];

export const attributes = pgTable('attributes', {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 255 }).notNull().unique(),
  type: attributeTypeEnum().notNull(),
  unit: varchar({ length: 32 }),
  description: text(),
  position: integer().notNull().default(0),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const attributesRelations = relations(attributes, ({ many }) => ({
  options: many(attributeOptions),
}));

export const attributeOptions = pgTable(
  'attribute_options',
  {
    id: uuid().primaryKey().defaultRandom(),
    attributeId: uuid()
      .notNull()
      .references(() => attributes.id, { onDelete: 'cascade' }),
    value: varchar({ length: 255 }).notNull(),
    position: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    attrValueUnique: unique('attribute_options_attribute_id_value_unique').on(t.attributeId, t.value),
  }),
);

export const attributeOptionsRelations = relations(attributeOptions, ({ one }) => ({
  attribute: one(attributes, { fields: [attributeOptions.attributeId], references: [attributes.id] }),
}));

export type Attribute = typeof attributes.$inferSelect;
export type NewAttribute = typeof attributes.$inferInsert;
export type AttributeOption = typeof attributeOptions.$inferSelect;
export type NewAttributeOption = typeof attributeOptions.$inferInsert;
