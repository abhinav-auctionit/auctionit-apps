export const SMS_SERVICE = Symbol('SMS_SERVICE');

export interface SmsSendInput {
  /** E.164 (`+919876543210`) or digits-only (`919876543210`) — providers normalize. */
  to: string;
  message: string;
}

export interface SmsService {
  send(input: SmsSendInput): Promise<void>;
}
