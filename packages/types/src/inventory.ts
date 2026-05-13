import { z } from 'zod';

export const attributeTypeSchema = z.enum(['text', 'number', 'single_select', 'multi_select']);
export type AttributeType = z.infer<typeof attributeTypeSchema>;

export const uomSchema = z.enum(['MT', 'KG', 'NOS', 'PCS', 'LTR', 'BAG', 'CUM', 'BOX']);
export type Uom = z.infer<typeof uomSchema>;

export const hsnCodeSchema = z.string().trim().min(1, 'HSN is required').max(32);

const nameField = z.string().trim().min(1).max(255);

export const createCategorySchema = z.object({ name: nameField });
export const updateCategorySchema = z.object({ name: nameField.optional() });
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const createSubcategorySchema = z.object({
  categoryId: z.string().uuid(),
  name: nameField,
});
export const updateSubcategorySchema = z.object({ name: nameField.optional() });
export type CreateSubcategoryInput = z.infer<typeof createSubcategorySchema>;

export const createAttributeSchema = z
  .object({
    name: nameField,
    type: attributeTypeSchema,
    unit: z.string().trim().max(32).optional(),
    description: z.string().trim().max(2000).optional(),
    options: z.array(z.string().trim().min(1).max(255)).optional(),
  })
  .superRefine((val, ctx) => {
    if ((val.type === 'single_select' || val.type === 'multi_select')) {
      if (!val.options || val.options.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options'],
          message: 'options required for select types',
        });
      }
    }
    if (val.type === 'number' && val.unit !== undefined && val.unit.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['unit'],
        message: 'unit cannot be empty when provided',
      });
    }
  });
export type CreateAttributeInput = z.infer<typeof createAttributeSchema>;

export const updateAttributeSchema = z.object({
  name: nameField.optional(),
  unit: z.string().trim().max(32).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  options: z.array(z.string().trim().min(1).max(255)).optional(),
});
export type UpdateAttributeInput = z.infer<typeof updateAttributeSchema>;

export const createItemSchema = z.object({
  subcategoryId: z.string().uuid(),
  name: nameField,
  uom: uomSchema,
  hsnCode: hsnCodeSchema,
  benchmarkCents: z.number().int().nonnegative().optional(),
});
export type CreateItemInput = z.infer<typeof createItemSchema>;

export const updateItemSchema = z.object({
  subcategoryId: z.string().uuid().optional(),
  name: nameField.optional(),
  uom: uomSchema.optional(),
  hsnCode: hsnCodeSchema.optional(),
  benchmarkCents: z.number().int().nonnegative().nullable().optional(),
});
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

export const itemAttributeValueInputSchema = z
  .object({
    attributeId: z.string().uuid().optional(),
    customName: nameField.optional(),
    valueText: z.string().max(2000).optional(),
    valueNumber: z.number().optional(),
    valueOptionIds: z.array(z.string().uuid()).optional(),
  })
  .superRefine((val, ctx) => {
    const hasAttr = !!val.attributeId;
    const hasCustom = !!val.customName;
    if (hasAttr === hasCustom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'provide exactly one of attributeId or customName',
      });
    }
    const valueCount =
      (val.valueText !== undefined ? 1 : 0) +
      (val.valueNumber !== undefined ? 1 : 0) +
      (val.valueOptionIds !== undefined ? 1 : 0);
    if (valueCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'one of valueText, valueNumber, valueOptionIds is required',
      });
    }
  });
export type ItemAttributeValueInput = z.infer<typeof itemAttributeValueInputSchema>;
