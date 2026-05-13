import { createZodDto } from 'nestjs-zod';
import { lotOutcomeNoteSchema } from '@auction/types';

export class LotOutcomeNoteDto extends createZodDto(lotOutcomeNoteSchema) {}
