import { createZodDto } from 'nestjs-zod';
import { otpVerifyMobileSchema } from '@auction/types';

export class OtpVerifyMobileDto extends createZodDto(otpVerifyMobileSchema) {}
