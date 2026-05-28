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

const clientEditableFields = {
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

  // Step 5 — Display
  displayMaterialLocation: z.boolean().default(false),
  displayPlantLocation: z.boolean().default(false),

  // When true, auctions for this client can carry a consolidatedEmdAmount
  // and admins can attach bidders in consolidated mode. When false, every
  // attachment must use lot-level EMD.
  allowsConsolidatedEmd: z.boolean().default(false),
};

type ClientEditableShape = {
  autoExtend: boolean;
  extendIfLastBidSec?: number | null;
  extendDurationSec?: number | null;
  extensionMaxTimes?: number | null;
  staggeringOfLots?: StaggeringOfLots | null;
  staggeringOfLotsDurationSec?: number | null;
  staggeringOfAuction?: boolean | null;
  staggeringOfAuctionDurationSec?: number | null;
  otherChargeType?: OtherChargeType | null;
  otherChargeAmount?: number | null;
};

const clientCrossFieldRefine = (d: ClientEditableShape, ctx: z.RefinementCtx) => {
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
};

export const clientCreateSchema = z
  .object({
    ...clientEditableFields,
    tncFileId: z.string().uuid().nullable().optional(),
  })
  .superRefine(clientCrossFieldRefine);
export type ClientCreateInput = z.infer<typeof clientCreateSchema>;

// Update schema excludes tncFileId — it has its own dedicated endpoint.
// All other client fields are editable here.
export const clientUpdateSchema = z
  .object(clientEditableFields)
  .superRefine(clientCrossFieldRefine);
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;

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

// -- Engagement history ------------------------------------------------------

export const engagementPurposeSchema = z.enum([
  'auction_follow_up',
  'auction_debrief',
  'complaint_escalation',
  'invoice_query',
  'general_check_in',
  'other',
]);
export type EngagementPurpose = z.infer<typeof engagementPurposeSchema>;

export const engagementMediumSchema = z.enum([
  'phone_call',
  'email',
  'in_person',
  'video_call',
  'whatsapp',
  'other',
]);
export type EngagementMedium = z.infer<typeof engagementMediumSchema>;

export const clientEngagementCreateSchema = z.object({
  happenedAt: z.string().datetime({ offset: true, message: 'Invalid date/time' }),
  personName: trimmed(120, 'Person met'),
  personRole: optTrimmed(120),
  purpose: engagementPurposeSchema,
  medium: engagementMediumSchema,
  comments: trimmed(4000, 'Comments'),
});
export type ClientEngagementCreateInput = z.infer<typeof clientEngagementCreateSchema>;

export const clientEngagementUpdateSchema = clientEngagementCreateSchema.partial();
export type ClientEngagementUpdateInput = z.infer<typeof clientEngagementUpdateSchema>;

// -- Internal contacts (KAMs etc.) -------------------------------------------

export const internalContactRoleSchema = z.enum([
  'kam',
  'asst_kam',
  'lifting_coordinator',
  'catalog_ops',
]);
export type InternalContactRole = z.infer<typeof internalContactRoleSchema>;

const userIdOrNull = z.string().uuid().nullable().optional();

export const internalContactsUpdateSchema = z.object({
  kam: userIdOrNull,
  asstKam: userIdOrNull,
  liftingCoordinator: userIdOrNull,
  catalogOps: userIdOrNull,
});
export type InternalContactsUpdateInput = z.infer<typeof internalContactsUpdateSchema>;
