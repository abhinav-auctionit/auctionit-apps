import { z } from 'zod';

export const auctionStatusSchema = z.enum([
  'draft',
  'scheduled',
  'live',
  'ended',
  'cancelled',
]);
export type AuctionStatus = z.infer<typeof auctionStatusSchema>;

export const auctionSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  startingPriceCents: z.number().int(),
  currentPriceCents: z.number().int(),
  bidIncrementCents: z.number().int(),
  status: auctionStatusSchema,
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  sellerId: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Auction = z.infer<typeof auctionSchema>;
