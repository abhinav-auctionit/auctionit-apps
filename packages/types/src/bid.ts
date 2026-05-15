import { z } from 'zod';

export const bidSchema = z.object({
  id: z.string().uuid(),
  lotId: z.string().uuid(),
  bidderId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  placedAt: z.string().datetime({ offset: true }),
});

export type Bid = z.infer<typeof bidSchema>;

export const placeBidSchema = z.object({
  amountCents: z.number().int().positive(),
  idempotencyKey: z.string().uuid().optional(),
});

export type PlaceBidInput = z.infer<typeof placeBidSchema>;

export const placeBidResultSchema = z.object({
  bid: bidSchema,
  lot: z.object({
    id: z.string().uuid(),
    currentBidCents: z.number().int().positive(),
    currentBidderId: z.string().uuid(),
    currentBidPlacedAt: z.string().datetime({ offset: true }),
    bidCount: z.number().int().nonnegative(),
    endTime: z.string().datetime({ offset: true }),
  }),
});

export type PlaceBidResult = z.infer<typeof placeBidResultSchema>;

const uomEnum = z.enum(['MT', 'KG', 'NOS', 'PCS', 'LTR', 'BAG', 'CUM', 'BOX']);
const auctionStatusEnum = z.enum([
  'draft',
  'scheduled',
  'live',
  'ended',
  'cancelled',
]);
const auctionTypeEnum = z.enum(['forward', 'reverse', 'sealed_bid', 'yankee']);

export const lotStateSchema = z.object({
  serverTime: z.string().datetime({ offset: true }),
  auction: z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    status: auctionStatusEnum,
    auctionType: auctionTypeEnum,
  }),
  lot: z.object({
    id: z.string().uuid(),
    lotNo: z.number().int().positive(),
    itemName: z.string(),
    qty: z.string(),
    uom: uomEnum,
    startTime: z.string().datetime({ offset: true }),
    endTime: z.string().datetime({ offset: true }),
    startingPriceCents: z.number().int().nonnegative(),
    bidIncrementCents: z.number().int().positive(),
    currentBidCents: z.number().int().positive().nullable(),
    currentBidderId: z.string().uuid().nullable(),
    currentBidPlacedAt: z.string().datetime({ offset: true }).nullable(),
    bidCount: z.number().int().nonnegative(),
  }),
  you: z.object({
    isAttached: z.boolean(),
    isCurrentHigh: z.boolean(),
    yourLastBidAmount: z.number().int().positive().nullable(),
    yourLastBidAt: z.string().datetime({ offset: true }).nullable(),
    emdHeldAmount: z.number().int().nonnegative(),
    nextValidBidCents: z.number().int().positive(),
  }),
  recentBids: z.array(
    z.object({
      id: z.string().uuid(),
      amountCents: z.number().int().positive(),
      placedAt: z.string().datetime({ offset: true }),
      bidderHandle: z.string(),
      isYou: z.boolean(),
    }),
  ),
});

export type LotState = z.infer<typeof lotStateSchema>;
