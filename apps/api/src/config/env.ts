import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  DATABASE_URL: z.string().url(),
  DATABASE_SSL: z.coerce.boolean().default(false),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

  CORS_ORIGINS: z.string().default(''),

  // Per-app origin lists drive **session cookie naming** so admin/bidder/client
  // apps each get an isolated cookie (e.g. auction_session_admin) even though
  // they all call the same API. Comma-separated, matched against the request's
  // Origin header. Origins outside any list fall back to the default cookie.
  APP_ADMIN_ORIGINS: z.string().default('http://localhost:5175'),
  APP_BIDDER_ORIGINS: z.string().default('http://localhost:5174'),
  APP_CLIENT_ORIGINS: z.string().default('http://localhost:5173'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).optional(),

  SESSION_COOKIE_NAME: z.string().default('auction_session'),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z.coerce.boolean().optional(),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),

  STORAGE_DRIVER: z.enum(['local', 'r2']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('uploads'),
  STORAGE_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  STORAGE_ALLOWED_MIME: z
    .string()
    .default(
      'image/jpeg,image/png,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_BASE_URL: z.string().url().optional(),

  SMS_DRIVER: z.enum(['stub', 'analytics_mantra']).default('stub'),
  SMS_USERNAME: z.string().optional(),
  SMS_PASSWORD: z.string().optional(),
  SMS_SENDER_ID: z.string().default('JIAUCT'),
  SMS_TYPE: z.string().default('TEXT'),
  SMS_BASE_URL: z
    .string()
    .url()
    .default('https://bulksms.analyticsmantra.com/sendsms/sendsms.php'),
  // DLT (TRAI) compliance params — required for Indian gateways. Defaults
  // match the existing JindalX/JIAUCT registration; override per-environment if
  // the templates ever change.
  SMS_DLT_PEID: z.string().default('1101616050000022954'),
  SMS_DLT_HEADER_ID: z.string().default('1205160327544676712'),
  SMS_DLT_TEMPLATE_ID: z.string().default('1207161778554839403'),
  // Token the gateway returns on successful submission. Body match (positive
  // check) is more reliable than HTTP status alone.
  SMS_SUCCESS_TOKEN: z.string().default('SUBMIT_SUCCESS'),
  // Must match the DLT-registered template content character-for-character apart
  // from the {OTP} placeholder, otherwise the gateway silently drops the message.
  SMS_OTP_TEMPLATE: z
    .string()
    .default(
      '{OTP} is your Authorization OTP for login verification. OTP will expire in 15 minutes. Regards- JindalX',
    ),
  // Auction-invitation DLT template. {AUCTION} is replaced with the auction's
  // code or name. Register a separate DLT template for this and override the
  // template id below; OTP and invitation traffic must not share a template id.
  SMS_INVITATION_TEMPLATE: z
    .string()
    .default(
      'You are invited to bid in auction {AUCTION}. Visit bid.auctionit.ai for details. Regards- JindalX',
    ),
  SMS_DLT_INVITATION_TEMPLATE_ID: z.string().optional(),
  // When true, log the full message body (incl. OTP) and gateway response.
  // When false, log only metadata (recipient, message length, status).
  // Recommend `false` in production to keep OTPs out of log aggregators.
  SMS_LOG_ENABLED: z.coerce.boolean().default(true),
});

export type Env = z.infer<typeof envSchema>;

export const validateEnv = (raw: Record<string, unknown>): Env => {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`invalid env: ${parsed.error.toString()}`);
  }
  return parsed.data;
};
