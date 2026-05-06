import { createZodDto } from 'nestjs-zod';
import { otpVerifyEmailSchema } from '@auction/types';

export class OtpVerifyEmailDto extends createZodDto(otpVerifyEmailSchema) {}
