import { z } from 'zod';

export const bidSchema = z.object({
  id: z.string().uuid(),
  auctionId: z.string().uuid(),
  bidderId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  placedAt: z.coerce.date(),
});

export type Bid = z.infer<typeof bidSchema>;

export const placeBidSchema = z.object({
  auctionId: z.string().uuid(),
  amountCents: z.number().int().positive(),
});

export type PlaceBidInput = z.infer<typeof placeBidSchema>;
