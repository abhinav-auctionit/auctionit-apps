import { createZodDto } from 'nestjs-zod';
import { clientEngagementUpdateSchema } from '@auction/types';

export class ClientEngagementUpdateDto extends createZodDto(clientEngagementUpdateSchema) {}
