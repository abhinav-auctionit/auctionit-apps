import { createZodDto } from 'nestjs-zod';
import { bidderRegisterSchema } from '@auction/types';

export class BidderRegisterDto extends createZodDto(bidderRegisterSchema) {}
