import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env';

const defaultLogLevel = (env: Env['NODE_ENV']): NonNullable<Env['LOG_LEVEL']> => {
  switch (env) {
    case 'production':
      return 'info';
    case 'staging':
      return 'info';
    case 'test':
      return 'warn';
    default:
      return 'debug';
  }
};

@Injectable()
export class AppConfig {
  constructor(private readonly cs: ConfigService<Env, true>) {}

  get nodeEnv() {
    return this.cs.get('NODE_ENV', { infer: true });
  }

  get isDev() {
    return this.nodeEnv === 'development';
  }

  get isStaging() {
    return this.nodeEnv === 'staging';
  }

  get isProd() {
    return this.nodeEnv === 'production';
  }

  get port() {
    return this.cs.get('PORT', { infer: true });
  }

  get database() {
    return {
      url: this.cs.get('DATABASE_URL', { infer: true }),
      ssl: this.cs.get('DATABASE_SSL', { infer: true }),
      poolMax: this.cs.get('DATABASE_POOL_MAX', { infer: true }),
    };
  }

  get cors() {
    const raw = this.cs.get('CORS_ORIGINS', { infer: true }) ?? '';
    return {
      origins: raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }

  get log() {
    return {
      level: this.cs.get('LOG_LEVEL', { infer: true }) ?? defaultLogLevel(this.nodeEnv),
    };
  }

  get cookies() {
    const explicit = this.cs.get('COOKIE_SECURE', { infer: true });
    return {
      name: this.cs.get('SESSION_COOKIE_NAME', { infer: true }),
      domain: this.cs.get('COOKIE_DOMAIN', { infer: true }) || undefined,
      secure: explicit ?? (this.isProd || this.isStaging),
    };
  }

  get session() {
    return {
      ttlDays: this.cs.get('SESSION_TTL_DAYS', { infer: true }),
    };
  }

  /**
   * Maps each frontend app's allowed origins to a stable role key used to
   * derive a per-app cookie name. Keeps admin/bidder/client sessions
   * cleanly isolated even though all four frontends call one API.
   */
  get apps(): Record<'admin' | 'bidder' | 'client', readonly string[]> {
    const split = (raw: string) =>
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    return {
      admin: split(this.cs.get('APP_ADMIN_ORIGINS', { infer: true })),
      bidder: split(this.cs.get('APP_BIDDER_ORIGINS', { infer: true })),
      client: split(this.cs.get('APP_CLIENT_ORIGINS', { infer: true })),
    };
  }

  /** Look up which app an Origin header belongs to, or null if unknown. */
  appKeyForOrigin(origin: string | null | undefined): 'admin' | 'bidder' | 'client' | null {
    if (!origin) return null;
    const apps = this.apps;
    if (apps.admin.includes(origin)) return 'admin';
    if (apps.bidder.includes(origin)) return 'bidder';
    if (apps.client.includes(origin)) return 'client';
    return null;
  }

  /**
   * Per-app cookie name (e.g. `auction_session_admin`) so a session set by
   * the admin frontend can't be read by the bidder frontend even though they
   * share the API host. Unknown origins fall back to the legacy default name.
   */
  sessionCookieNameFor(appKey: 'admin' | 'bidder' | 'client' | null): string {
    const base = this.cs.get('SESSION_COOKIE_NAME', { infer: true });
    return appKey ? `${base}_${appKey}` : base;
  }

  get storage() {
    const allowedMimeRaw = this.cs.get('STORAGE_ALLOWED_MIME', { infer: true }) ?? '';
    return {
      driver: this.cs.get('STORAGE_DRIVER', { infer: true }),
      localDir: this.cs.get('STORAGE_LOCAL_DIR', { infer: true }),
      maxUploadBytes: this.cs.get('STORAGE_MAX_UPLOAD_BYTES', { infer: true }),
      allowedMime: allowedMimeRaw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
      r2: {
        accountId: this.cs.get('R2_ACCOUNT_ID', { infer: true }),
        accessKeyId: this.cs.get('R2_ACCESS_KEY_ID', { infer: true }),
        secretAccessKey: this.cs.get('R2_SECRET_ACCESS_KEY', { infer: true }),
        bucket: this.cs.get('R2_BUCKET', { infer: true }),
        publicBaseUrl: this.cs.get('R2_PUBLIC_BASE_URL', { infer: true }),
      },
    };
  }

  get sms() {
    return {
      driver: this.cs.get('SMS_DRIVER', { infer: true }),
      username: this.cs.get('SMS_USERNAME', { infer: true }),
      password: this.cs.get('SMS_PASSWORD', { infer: true }),
      senderId: this.cs.get('SMS_SENDER_ID', { infer: true }),
      type: this.cs.get('SMS_TYPE', { infer: true }),
      baseUrl: this.cs.get('SMS_BASE_URL', { infer: true }),
      otpTemplate: this.cs.get('SMS_OTP_TEMPLATE', { infer: true }),
      dltPeid: this.cs.get('SMS_DLT_PEID', { infer: true }),
      dltHeaderId: this.cs.get('SMS_DLT_HEADER_ID', { infer: true }),
      dltTemplateId: this.cs.get('SMS_DLT_TEMPLATE_ID', { infer: true }),
      successToken: this.cs.get('SMS_SUCCESS_TOKEN', { infer: true }),
      logEnabled: this.cs.get('SMS_LOG_ENABLED', { infer: true }),
    };
  }
}
