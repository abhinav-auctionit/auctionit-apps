import { Global, Logger, Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service';
import { AnalyticsMantraSmsService } from './analytics-mantra.sms';
import { SMS_SERVICE, type SmsService } from './sms.service';
import { StubSmsService } from './stub.sms';

const buildSmsService = (config: AppConfig): SmsService => {
  const logger = new Logger('SmsModule');
  const sms = config.sms;

  if (sms.driver === 'analytics_mantra') {
    if (!sms.username || !sms.password) {
      throw new Error(
        'SMS_DRIVER=analytics_mantra requires SMS_USERNAME and SMS_PASSWORD',
      );
    }
    logger.log(
      `using Analytics Mantra SMS gateway (sender=${sms.senderId}, ` +
        `host=${new URL(sms.baseUrl).host}, dlt-template=${sms.dltTemplateId ?? '(none)'})`,
    );
    return new AnalyticsMantraSmsService({
      baseUrl: sms.baseUrl,
      username: sms.username,
      password: sms.password,
      senderId: sms.senderId,
      type: sms.type,
      dltPeid: sms.dltPeid,
      dltHeaderId: sms.dltHeaderId,
      dltTemplateId: sms.dltTemplateId,
      successToken: sms.successToken,
    });
  }

  logger.log('using stub SMS service (logs to console — no real SMS delivered)');
  return new StubSmsService();
};

@Global()
@Module({
  providers: [
    {
      provide: SMS_SERVICE,
      inject: [AppConfig],
      useFactory: buildSmsService,
    },
  ],
  exports: [SMS_SERVICE],
})
export class SmsModule {}
