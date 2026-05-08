import { Logger } from '@nestjs/common';
import type { SmsSendInput, SmsService } from './sms.service';

export interface AnalyticsMantraConfig {
  baseUrl: string;
  username: string;
  password: string;
  senderId: string;
  type: string;
  /** TRAI/DLT principal entity id. Required by Indian SMS gateways. */
  dltPeid?: string;
  /** TRAI/DLT header (sender ID) registration id. */
  dltHeaderId?: string;
  /** TRAI/DLT message-template registration id matching the body content. */
  dltTemplateId?: string;
  /** Substring the gateway returns on successful submission (e.g. "SUBMIT_SUCCESS"). */
  successToken: string;
  /** When true, log full message body + response. When false, log metadata only. */
  logEnabled: boolean;
}

export class AnalyticsMantraSmsService implements SmsService {
  private readonly logger = new Logger(AnalyticsMantraSmsService.name);

  constructor(private readonly cfg: AnalyticsMantraConfig) {}

  async send({ to, message }: SmsSendInput): Promise<void> {
    // Gateway expects digits only — strip leading "+" if E.164 was passed in.
    const mobile = to.replace(/^\+/, '');
    const startedAt = Date.now();

    if (this.cfg.logEnabled) {
      this.logger.log(`[SMS] sending to=${mobile} message="${message}"`);
    } else {
      this.logger.log(`[SMS] sending to=${mobile} length=${message.length}`);
    }

    const url = new URL(this.cfg.baseUrl);
    url.searchParams.set('username', this.cfg.username);
    url.searchParams.set('password', this.cfg.password);
    url.searchParams.set('type', this.cfg.type);
    url.searchParams.set('sender', this.cfg.senderId);
    url.searchParams.set('mobile', mobile);
    url.searchParams.set('message', message);
    if (this.cfg.dltPeid) url.searchParams.set('PEID', this.cfg.dltPeid);
    if (this.cfg.dltHeaderId) url.searchParams.set('HeaderId', this.cfg.dltHeaderId);
    if (this.cfg.dltTemplateId) url.searchParams.set('templateId', this.cfg.dltTemplateId);

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method: 'GET',
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      // Don't include the URL in the error — it carries credentials.
      this.logger.error(
        `[SMS] gateway request failed to=${mobile} latency=${Date.now() - startedAt}ms ` +
          `err=${err instanceof Error ? err.message : String(err)}`,
      );
      throw new Error('SMS gateway unreachable');
    }

    const body = (await res.text()).trim();
    const latency = Date.now() - startedAt;

    if (!res.ok) {
      this.logger.error(
        `[SMS] gateway HTTP ${res.status} to=${mobile} latency=${latency}ms ` +
          `body=${body.slice(0, 200)}`,
      );
      throw new Error('SMS gateway error');
    }

    // Indian bulk-SMS PHP gateways return HTTP 200 even on failure with an error
    // string in the body. Mirror the legacy .NET code's check: success means the
    // configured token (default "SUBMIT_SUCCESS") appears in the response body.
    if (!body.includes(this.cfg.successToken)) {
      this.logger.error(
        `[SMS] gateway did not confirm success to=${mobile} latency=${latency}ms ` +
          `body=${body.slice(0, 200)}`,
      );
      throw new Error('SMS gateway returned non-success response');
    }

    if (this.cfg.logEnabled) {
      this.logger.log(
        `[SMS] dispatched to=${mobile} status=success latency=${latency}ms response=${body.slice(0, 200)}`,
      );
    } else {
      this.logger.log(
        `[SMS] dispatched to=${mobile} status=success latency=${latency}ms`,
      );
    }
  }
}
