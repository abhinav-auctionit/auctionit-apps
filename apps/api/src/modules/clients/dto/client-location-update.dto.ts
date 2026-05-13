import { createZodDto } from 'nestjs-zod';
import { clientLocationUpdateSchema } from '@auction/types';

export class ClientLocationUpdateDto extends createZodDto(clientLocationUpdateSchema) {}
