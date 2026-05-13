import { createZodDto } from 'nestjs-zod';
import { createAuctionSchema } from '@auction/types';

export class CreateAuctionDto extends createZodDto(createAuctionSchema) {}
