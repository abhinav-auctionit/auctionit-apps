import { createZodDto } from 'nestjs-zod';
import { attachToLotsSchema } from '@auction/types';

export class AttachToLotsDto extends createZodDto(attachToLotsSchema) {}
