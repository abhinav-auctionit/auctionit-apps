import { createZodDto } from 'nestjs-zod';
import { clientCreateSchema } from '@auction/types';

export class ClientCreateDto extends createZodDto(clientCreateSchema) {}
