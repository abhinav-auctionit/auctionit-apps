import { createZodDto } from 'nestjs-zod';
import {
  createAttributeSchema,
  createCategorySchema,
  createItemSchema,
  createMicrocategorySchema,
  createSubcategorySchema,
  itemAttributeValueInputSchema,
  updateAttributeSchema,
  updateCategorySchema,
  updateItemSchema,
  updateMicrocategorySchema,
  updateSubcategorySchema,
} from '@auction/types';

export class CreateCategoryDto extends createZodDto(createCategorySchema) {}
export class UpdateCategoryDto extends createZodDto(updateCategorySchema) {}
export class CreateSubcategoryDto extends createZodDto(createSubcategorySchema) {}
export class UpdateSubcategoryDto extends createZodDto(updateSubcategorySchema) {}
export class CreateMicrocategoryDto extends createZodDto(createMicrocategorySchema) {}
export class UpdateMicrocategoryDto extends createZodDto(updateMicrocategorySchema) {}
export class CreateAttributeDto extends createZodDto(createAttributeSchema) {}
export class UpdateAttributeDto extends createZodDto(updateAttributeSchema) {}
export class CreateItemDto extends createZodDto(createItemSchema) {}
export class UpdateItemDto extends createZodDto(updateItemSchema) {}
export class ItemAttributeValueInputDto extends createZodDto(itemAttributeValueInputSchema) {}
