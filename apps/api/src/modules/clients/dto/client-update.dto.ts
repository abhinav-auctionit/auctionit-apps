import { createZodDto } from 'nestjs-zod';
import { clientUpdateSchema } from '@auction/types';

export class ClientUpdateDto extends createZodDto(clientUpdateSchema) {}
