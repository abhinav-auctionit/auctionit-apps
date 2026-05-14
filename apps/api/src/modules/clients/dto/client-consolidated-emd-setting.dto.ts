import { createZodDto } from 'nestjs-zod';
import { clientConsolidatedEmdSettingSchema } from '@auction/types';

export class ClientConsolidatedEmdSettingDto extends createZodDto(
  clientConsolidatedEmdSettingSchema,
) {}
