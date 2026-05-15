import { createZodDto } from 'nestjs-zod';
import { placeBidSchema } from '@auction/types';

export class PlaceBidDto extends createZodDto(placeBidSchema) {}
