import { createZodDto } from 'nestjs-zod';
import { createLotSchema } from '@auction/types';

export class CreateLotDto extends createZodDto(createLotSchema) {}
