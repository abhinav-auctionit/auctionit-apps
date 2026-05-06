import { z } from 'zod';
import { interestedInSchema } from './auth.js';

export const companyTypeSchema = z.enum([
  'llp',
  'llc',
  'individual',
  'limited',
  'partnership',
  'pvt_limited',
  'sole_proprietorship',
]);
export type CompanyType = z.infer<typeof companyTypeSchema>;

export const businessActivitySchema = z.enum(['broker', 'end_user', 'trader', 'other']);
export type BusinessActivity = z.infer<typeof businessActivitySchema>;

export const subscriptionTypeSchema = z.enum(['annual', 'lifetime']);
export type SubscriptionType = z.infer<typeof subscriptionTypeSchema>;

export const bidderStatusSchema = z.enum([
  'draft',
  'pending_approval',
  'approved',
  'rejected',
]);
export type BidderStatus = z.infer<typeof bidderStatusSchema>;

export const bidderCountrySchema = z.enum(['India', 'UAE']);
export type BidderCountry = z.infer<typeof bidderCountrySchema>;

const countryCode = z.string().regex(/^\+\d{1,3}$/, 'invalid country code');
const mobileDigits = z
  .string()
  .regex(/^\d{7,15}$/, 'mobile must be 7-15 digits with no spaces or dashes');

export const bidderProfilePatchSchema = z
  .object({
    // Personal
    interestedIn: interestedInSchema,
    fullName: z.string().min(1).max(255).trim(),
    contactCountryCode: countryCode,
    contactNumber: mobileDigits,
    whatsappCountryCode: countryCode,
    whatsappNumber: mobileDigits,

    // Company
    companyName: z.string().min(1).max(255).trim(),
    companyType: companyTypeSchema,
    businessActivity: businessActivitySchema,
    address: z.string().min(1).max(1024).trim(),
    country: bidderCountrySchema,
    state: z.string().min(1).max(128).trim(),
    city: z.string().min(1).max(128).trim(),
    pinCode: z.string().min(1).max(16).trim(),
    designation: z.string().min(1).max(128).trim(),
    secondaryNumber: z.string().max(32).trim().nullable(),
    registeredEmail: z.string().email().toLowerCase().trim(),
    gst: z.string().min(1).max(32).trim(),
    pan: z.string().min(1).max(16).trim().toUpperCase(),

    // Documents
    panCardFileId: z.string().uuid().nullable(),
    proofOfAddressFileId: z.string().uuid().nullable(),
    cancelledChequeFileId: z.string().uuid().nullable(),
    otherFileId: z.string().uuid().nullable(),
    bankAccountNumber: z.string().min(1).max(64).trim(),
    bankName: z.string().min(1).max(255).trim(),
    ifscCode: z.string().min(1).max(16).trim().toUpperCase(),

    // Terms
    termsAccepted: z.boolean(),
    signatoryName: z.string().min(1).max(255).trim(),
    signatoryDesignation: z.string().min(1).max(128).trim(),
    signatoryPlace: z.string().min(1).max(128).trim(),
    signatoryDate: z.coerce.date(),

    // Payment
    subscriptionType: subscriptionTypeSchema,
  })
  .partial();
export type BidderProfilePatchInput = z.infer<typeof bidderProfilePatchSchema>;
