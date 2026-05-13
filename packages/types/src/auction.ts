import { z } from 'zod';
import { uomSchema } from './inventory.js';

export const auctionStatusSchema = z.enum([
  'draft',
  'scheduled',
  'live',
  'ended',
  'cancelled',
]);
export type AuctionStatus = z.infer<typeof auctionStatusSchema>;

export const auctionTypeSchema = z.enum(['forward', 'reverse', 'sealed_bid', 'yankee']);
export type AuctionType = z.infer<typeof auctionTypeSchema>;

export const lotOutcomeStatusSchema = z.enum([
  'pending_lift',
  'lifted',
  'forfeited',
  'rejected_by_client',
  'no_winner',
]);
export type LotOutcomeStatus = z.infer<typeof lotOutcomeStatusSchema>;

const trimmedString = (max: number) => z.string().trim().min(1).max(max);

export const createAuctionSchema = z.object({
  clientId: z.string().uuid(),
  locationId: z.string().uuid().optional().nullable(),
  code: trimmedString(64),
  name: trimmedString(255),
  auctionType: auctionTypeSchema,
  /**
   * Optional. When set, the auction runs in consolidated EMD mode — a single
   * deposit per bidder covers participation across all lots. When null, the
   * auction runs in lot-level mode where each lot has its own EMD hold.
   */
  consolidatedEmdAmount: z.number().int().nonnegative().nullable().optional(),
  description: z.string().trim().max(4000).optional().nullable(),
});
export type CreateAuctionInput = z.infer<typeof createAuctionSchema>;

// `PATCH /admin/auctions/:id` accepts a subset; status transitions to `ended`
// and `cancelled` must go through dedicated endpoints (so EMDs get processed),
// but the rest are free to edit while no participants are attached.
export const updateAuctionSchema = z
  .object({
    locationId: z.string().uuid().nullable(),
    code: trimmedString(64),
    name: trimmedString(255),
    auctionType: auctionTypeSchema,
    consolidatedEmdAmount: z.number().int().nonnegative().nullable(),
    description: z.string().trim().max(4000).nullable(),
    status: z.enum(['draft', 'scheduled', 'live']),
  })
  .partial();
export type UpdateAuctionInput = z.infer<typeof updateAuctionSchema>;

export const createLotSchema = z
  .object({
    itemId: z.string().uuid().optional().nullable(),
    itemName: trimmedString(255),
    description: z.string().trim().max(4000).optional().nullable(),
    qty: z.coerce.number().positive('Quantity must be greater than 0'),
    uom: uomSchema,
    auctionDate: z.coerce.date(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    startingPriceCents: z.number().int().nonnegative(),
    bidIncrementCents: z.number().int().positive().default(100),
    emdAmount: z.number().int().nonnegative(),
  })
  .refine((d) => d.endTime > d.startTime, {
    path: ['endTime'],
    message: 'End time must be after start time',
  });
export type CreateLotInput = z.infer<typeof createLotSchema>;

export const updateLotSchema = z
  .object({
    itemId: z.string().uuid().nullable(),
    itemName: trimmedString(255),
    description: z.string().trim().max(4000).nullable(),
    qty: z.coerce.number().positive(),
    uom: uomSchema,
    auctionDate: z.coerce.date(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    startingPriceCents: z.number().int().nonnegative(),
    bidIncrementCents: z.number().int().positive(),
    emdAmount: z.number().int().nonnegative(),
  })
  .partial()
  .refine(
    (d) => !d.startTime || !d.endTime || d.endTime > d.startTime,
    {
      path: ['endTime'],
      message: 'End time must be after start time',
    },
  );
export type UpdateLotInput = z.infer<typeof updateLotSchema>;

export const auctionListQuerySchema = z.object({
  clientId: z.string().uuid().optional(),
  code: z.string().trim().min(1).optional(),
  status: auctionStatusSchema.optional(),
});
export type AuctionListQuery = z.infer<typeof auctionListQuerySchema>;

// Admin-driven participation. In lot-level mode, attach a bidder to specific
// lots — each lot's EMD is held. In consolidated mode, attach a bidder to
// the auction itself — the consolidated EMD is held once.
export const attachToLotsSchema = z.object({
  bidderProfileIds: z.array(z.string().uuid()).min(1).max(100),
  lotIds: z.array(z.string().uuid()).min(1).max(100),
});
export type AttachToLotsInput = z.infer<typeof attachToLotsSchema>;

export const attachToConsolidatedSchema = z.object({
  bidderProfileIds: z.array(z.string().uuid()).min(1).max(100),
});
export type AttachToConsolidatedInput = z.infer<typeof attachToConsolidatedSchema>;

// Optional admin note attached to lot-outcome and cancellation transitions.
export const lotOutcomeNoteSchema = z.object({
  note: z.string().trim().max(2000).optional().nullable(),
});
export type LotOutcomeNoteInput = z.infer<typeof lotOutcomeNoteSchema>;
