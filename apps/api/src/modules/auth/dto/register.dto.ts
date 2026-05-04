import { createZodDto } from 'nestjs-zod';
import { registerSchema } from '@auction/types';

export class RegisterDto extends createZodDto(registerSchema) {}
