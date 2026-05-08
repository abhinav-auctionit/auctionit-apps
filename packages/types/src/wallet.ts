import { z } from 'zod';

export const walletTxnKindSchema = z.enum([
  'admin_credit',
  'admin_debit_correction',
  'emd_debit',
  'emd_refund',
  'emd_forfeit',
]);
export type WalletTxnKind = z.infer<typeof walletTxnKindSchema>;

const amountSchema = z
  .number()
  .int('amount must be a whole number of rupees')
  .positive('amount must be greater than zero')
  .max(100_000_000, 'amount exceeds limit of 10 crore');

export const walletCreditSchema = z.object({
  amount: amountSchema,
  note: z.string().max(2000).trim().optional(),
});
export type WalletCreditInput = z.infer<typeof walletCreditSchema>;

export const walletDebitSchema = z.object({
  amount: amountSchema,
  note: z.string().min(1, 'note is required for corrections').max(2000).trim(),
});
export type WalletDebitInput = z.infer<typeof walletDebitSchema>;

export const walletTxnQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
  before: z.coerce.date().optional(),
});
export type WalletTxnQuery = z.infer<typeof walletTxnQuerySchema>;
