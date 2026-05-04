import { createZodDto } from 'nestjs-zod';
import { loginSchema } from '@auction/types';

export class LoginDto extends createZodDto(loginSchema) {}
