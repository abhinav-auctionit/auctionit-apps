import { z } from 'zod';
import { bidderStatusSchema } from './bidder.js';

export const bidderRejectSchema = z.object({
  note: z.string().min(1).max(2000).trim(),
});
export type BidderRejectInput = z.infer<typeof bidderRejectSchema>;

export const bidderMarkFeePaidSchema = z.object({
  note: z.string().max(2000).trim().optional(),
});
export type BidderMarkFeePaidInput = z.infer<typeof bidderMarkFeePaidSchema>;

export const bidderListQuerySchema = z.object({
  status: bidderStatusSchema.optional(),
});
export type BidderListQuery = z.infer<typeof bidderListQuerySchema>;
