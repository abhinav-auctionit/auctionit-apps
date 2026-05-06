import { createZodDto } from 'nestjs-zod';
import { bidderMarkFeePaidSchema } from '@auction/types';

export class BidderMarkFeePaidDto extends createZodDto(bidderMarkFeePaidSchema) {}
