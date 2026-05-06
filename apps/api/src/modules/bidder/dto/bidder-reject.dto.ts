import { createZodDto } from 'nestjs-zod';
import { bidderRejectSchema } from '@auction/types';

export class BidderRejectDto extends createZodDto(bidderRejectSchema) {}
