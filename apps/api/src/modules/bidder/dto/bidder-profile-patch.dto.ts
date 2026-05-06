import { createZodDto } from 'nestjs-zod';
import { bidderProfilePatchSchema } from '@auction/types';

export class BidderProfilePatchDto extends createZodDto(bidderProfilePatchSchema) {}
