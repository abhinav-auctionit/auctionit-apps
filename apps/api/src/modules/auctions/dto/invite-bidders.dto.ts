import { createZodDto } from 'nestjs-zod';
import { inviteBiddersSchema } from '@auction/types';

export class InviteBiddersDto extends createZodDto(inviteBiddersSchema) {}
