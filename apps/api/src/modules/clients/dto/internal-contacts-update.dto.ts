import { createZodDto } from 'nestjs-zod';
import { internalContactsUpdateSchema } from '@auction/types';

export class InternalContactsUpdateDto extends createZodDto(internalContactsUpdateSchema) {}
