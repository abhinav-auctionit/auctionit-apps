import { Logger } from '@nestjs/common';
import type { SmsSendInput, SmsService } from './sms.service';

export class StubSmsService implements SmsService {
  private readonly logger = new Logger(StubSmsService.name);

  async send({ to, message }: SmsSendInput): Promise<void> {
    this.logger.log(`[SMS-STUB] to=${to} msg="${message}"`);
  }
}
