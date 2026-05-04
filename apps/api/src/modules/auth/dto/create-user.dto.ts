import { createZodDto } from 'nestjs-zod';
import { createUserSchema } from '@auction/types';

export class CreateUserDto extends createZodDto(createUserSchema) {}
