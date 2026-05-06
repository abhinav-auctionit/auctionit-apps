import { createZodDto } from 'nestjs-zod';
import { otpSendEmailSchema } from '@auction/types';

export class OtpSendEmailDto extends createZodDto(otpSendEmailSchema) {}
