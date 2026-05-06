import { createZodDto } from 'nestjs-zod';
import { otpSendMobileSchema } from '@auction/types';

export class OtpSendMobileDto extends createZodDto(otpSendMobileSchema) {}
