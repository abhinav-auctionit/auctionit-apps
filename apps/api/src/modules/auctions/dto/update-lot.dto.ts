import { createZodDto } from 'nestjs-zod';
import { updateLotSchema } from '@auction/types';

export class UpdateLotDto extends createZodDto(updateLotSchema) {}
