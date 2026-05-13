import { createZodDto } from 'nestjs-zod';
import { clientContactUpdateSchema } from '@auction/types';

export class ClientContactUpdateDto extends createZodDto(clientContactUpdateSchema) {}
