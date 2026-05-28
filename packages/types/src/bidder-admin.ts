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
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});
export type BidderListQuery = z.infer<typeof bidderListQuerySchema>;
