import { createZodDto } from 'nestjs-zod';
import { walletDebitSchema } from '@auction/types';

export class WalletDebitDto extends createZodDto(walletDebitSchema) {}
