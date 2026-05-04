import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createAuctionSchema = z
  .object({
    title: z.string().min(3).max(255),
    description: z.string().max(5000).optional(),
    startingPriceCents: z.number().int().nonnegative(),
    bidIncrementCents: z.number().int().positive().default(100),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .refine((v) => v.endsAt > v.startsAt, {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  });

export class CreateAuctionDto extends createZodDto(createAuctionSchema) {}
