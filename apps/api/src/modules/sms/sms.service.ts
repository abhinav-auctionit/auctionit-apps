export const SMS_SERVICE = Symbol('SMS_SERVICE');

export interface SmsSendInput {
  /** E.164 (`+919876543210`) or digits-only (`919876543210`) — providers normalize. */
  to: string;
  message: string;
  /** Optional DLT template id override (e.g. invitation vs OTP have separate templates). */
  dltTemplateId?: string;
}

export interface SmsService {
  send(input: SmsSendInput): Promise<void>;
}
