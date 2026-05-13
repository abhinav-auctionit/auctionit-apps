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

const trimmedString = (max: number) => z.string().trim().min(1).max(max);

export const createAuctionSchema = z.object({
  clientId: z.string().uuid(),
  code: trimmedString(64),
  name: trimmedString(255),
  auctionType: auctionTypeSchema,
  emdAmount: z.number().int().nonnegative().default(0),
  description: z.string().trim().max(4000).optional().nullable(),
});
export type CreateAuctionInput = z.infer<typeof createAuctionSchema>;

export const updateAuctionSchema = z
  .object({
    code: trimmedString(64),
    name: trimmedString(255),
    auctionType: auctionTypeSchema,
    emdAmount: z.number().int().nonnegative(),
    description: z.string().trim().max(4000).nullable(),
    status: auctionStatusSchema,
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

export const invitationNotificationStatusSchema = z.enum([
  'pending',
  'sent',
  'failed',
  'skipped',
]);
export type InvitationNotificationStatus = z.infer<typeof invitationNotificationStatusSchema>;

export const inviteBiddersSchema = z.object({
  bidderProfileIds: z
    .array(z.string().uuid())
    .min(1, 'At least one bidder is required')
    .max(100, 'Cannot invite more than 100 bidders at a time'),
});
export type InviteBiddersInput = z.infer<typeof inviteBiddersSchema>;
