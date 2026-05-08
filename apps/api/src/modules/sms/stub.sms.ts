import { Logger } from '@nestjs/common';
import type { SmsSendInput, SmsService } from './sms.service';

export class StubSmsService implements SmsService {
  private readonly logger = new Logger(StubSmsService.name);

  constructor(private readonly logEnabled: boolean = true) {}

  async send({ to, message }: SmsSendInput): Promise<void> {
    if (this.logEnabled) {
      this.logger.log(`[SMS-STUB] to=${to} msg="${message}"`);
    } else {
      this.logger.log(`[SMS-STUB] to=${to} length=${message.length}`);
    }
  }
}
