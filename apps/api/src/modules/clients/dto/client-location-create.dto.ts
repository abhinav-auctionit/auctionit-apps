import { createZodDto } from 'nestjs-zod';
import { clientLocationCreateSchema } from '@auction/types';

export class ClientLocationCreateDto extends createZodDto(clientLocationCreateSchema) {}
