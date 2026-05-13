import { createZodDto } from 'nestjs-zod';
import { clientEngagementCreateSchema } from '@auction/types';

export class ClientEngagementCreateDto extends createZodDto(clientEngagementCreateSchema) {}
