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
}
