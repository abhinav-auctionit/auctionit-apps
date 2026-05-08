import { createZodDto } from 'nestjs-zod';
import { walletCreditSchema } from '@auction/types';

export class WalletCreditDto extends createZodDto(walletCreditSchema) {}
