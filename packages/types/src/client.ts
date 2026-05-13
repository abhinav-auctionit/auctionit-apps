import { z } from 'zod';

export const otherChargeTypeSchema = z.enum(['flat', 'percentage']);
export type OtherChargeType = z.infer<typeof otherChargeTypeSchema>;

export const staggeringOfLotsSchema = z.enum(['none', 'all_lots', 'subsequent_lots']);
export type StaggeringOfLots = z.infer<typeof staggeringOfLotsSchema>;

export const clientCountrySchema = z.enum(['India', 'UAE']);
export type ClientCountry = z.infer<typeof clientCountrySchema>;

const trimmed = (max: number, label: string) =>
  z.string().trim().min(1, `${label} is required`).max(max);
const optTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional();

const positiveInt = (label: string) =>
  z.number().int().nonnegative(`${label} must be 0 or greater`);

export const clientCreateSchema = z
  .object({
    // Step 1 — Company
    companyName: trimmed(100, 'Company name'),
    phone: optTrimmed(20),
    websiteUrl: optTrimmed(100),
    registeredAddress: trimmed(500, 'Registered address'),
    country: clientCountrySchema,

    // Step 2 — Tax & status
    pan: trimmed(10, 'PAN').toUpperCase(),
    tan: trimmed(10, 'TAN').toUpperCase(),
    tin: trimmed(15, 'TIN').toUpperCase(),
    isActive: z.boolean().default(true),

    // Step 3 — Auction config
    prefixAuctionCode: optTrimmed(25),
    suffixAuctionCode: optTrimmed(25),
    autoExtend: z.boolean().default(false),
    extendIfLastBidSec: positiveInt('Extend if last bid').nullable().optional(),
    extendDurationSec: positiveInt('Extend duration').nullable().optional(),
    extensionMaxTimes: positiveInt('Extension count').nullable().optional(),
    staggeringOfLots: staggeringOfLotsSchema.nullable().optional(),
    staggeringOfLotsDurationSec: positiveInt('Lot stagger duration').nullable().optional(),
    staggeringOfAuction: z.boolean().nullable().optional(),
    staggeringOfAuctionDurationSec: positiveInt('Auction stagger duration')
      .nullable()
      .optional(),

    // Step 4 — Charges & revenue
    otherChargeType: otherChargeTypeSchema.nullable().optional(),
    otherChargeAmount: positiveInt('Other charge amount').nullable().optional(),
    revenueRate: positiveInt('Revenue rate'),
    plantTechPersonDetails: optTrimmed(200),

    // Step 5 — Display & T&C
    displayMaterialLocation: z.boolean().default(false),
    displayPlantLocation: z.boolean().default(false),
    tncFileId: z.string().uuid().nullable().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.autoExtend) {
      if (d.extendIfLastBidSec == null) {
        ctx.addIssue({
          code: 'custom',
          path: ['extendIfLastBidSec'],
          message: 'required when auto-extend is on',
        });
      }
      if (d.extendDurationSec == null) {
        ctx.addIssue({
          code: 'custom',
          path: ['extendDurationSec'],
          message: 'required when auto-extend is on',
        });
      }
      if (d.extensionMaxTimes == null) {
        ctx.addIssue({
          code: 'custom',
          path: ['extensionMaxTimes'],
          message: 'required when auto-extend is on',
        });
      }
    }
    if (
      d.staggeringOfLots &&
      d.staggeringOfLots !== 'none' &&
      d.staggeringOfLotsDurationSec == null
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['staggeringOfLotsDurationSec'],
        message: 'required when staggering of lots is enabled',
      });
    }
    if (d.staggeringOfAuction && d.staggeringOfAuctionDurationSec == null) {
      ctx.addIssue({
        code: 'custom',
        path: ['staggeringOfAuctionDurationSec'],
        message: 'required when staggering of auctions is enabled',
      });
    }
    if (d.otherChargeType && d.otherChargeAmount == null) {
      ctx.addIssue({
        code: 'custom',
        path: ['otherChargeAmount'],
        message: 'required when other-charge type is set',
      });
    }
  });
export type ClientCreateInput = z.infer<typeof clientCreateSchema>;

// -- Locations & contact points ----------------------------------------------

export const clientLocationCreateSchema = z.object({
  name: trimmed(120, 'Location name'),
  addressLine: optTrimmed(255),
  city: trimmed(80, 'City'),
  state: trimmed(80, 'State'),
  pincode: trimmed(15, 'Pincode'),
  country: trimmed(64, 'Country'),
  isPrimary: z.boolean().default(false),
});
export type ClientLocationCreateInput = z.infer<typeof clientLocationCreateSchema>;

export const clientLocationUpdateSchema = clientLocationCreateSchema.partial();
export type ClientLocationUpdateInput = z.infer<typeof clientLocationUpdateSchema>;

const optEmail = z
  .union([
    z.literal('').transform(() => null),
    z.string().trim().email('Invalid email').max(255),
    z.null(),
  ])
  .optional();

export const clientContactCreateSchema = z.object({
  name: trimmed(120, 'Contact name'),
  role: optTrimmed(120),
  email: optEmail,
  phone: optTrimmed(30),
});
export type ClientContactCreateInput = z.infer<typeof clientContactCreateSchema>;

export const clientContactUpdateSchema = clientContactCreateSchema.partial();
export type ClientContactUpdateInput = z.infer<typeof clientContactUpdateSchema>;
