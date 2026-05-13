import { createZodDto } from 'nestjs-zod';
import { updateAuctionSchema } from '@auction/types';

export class UpdateAuctionDto extends createZodDto(updateAuctionSchema) {}
