import { createZodDto } from 'nestjs-zod';
import { attachToConsolidatedSchema } from '@auction/types';

export class AttachToConsolidatedDto extends createZodDto(attachToConsolidatedSchema) {}
