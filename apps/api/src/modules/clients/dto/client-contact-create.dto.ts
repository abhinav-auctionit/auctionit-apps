import { createZodDto } from 'nestjs-zod';
import { clientContactCreateSchema } from '@auction/types';

export class ClientContactCreateDto extends createZodDto(clientContactCreateSchema) {}
