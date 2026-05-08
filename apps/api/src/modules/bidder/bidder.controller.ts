import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { walletTxnQuerySchema } from '@auction/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { SafeUser } from '../auth/session.service';
import { BidderService } from './bidder.service';
import { WalletService } from './wallet.service';
import { BidderProfilePatchDto } from './dto/bidder-profile-patch.dto';
import { STATES_BY_COUNTRY } from './constants';

@ApiTags('bidder')
@Controller('bidder')
export class BidderController {
  constructor(
    private readonly bidder: BidderService,
    private readonly wallet: WalletService,
  ) {}

  @Public()
  @Get('countries')
  @HttpCode(200)
  countries() {
    return STATES_BY_COUNTRY;
  }

  @Roles('bidder', 'admin')
  @Get('me/profile')
  getMine(@CurrentUser() user: SafeUser) {
    return this.bidder.getMyProfile(user);
  }

  @Roles('bidder')
  @Patch('me/profile')
  patchMine(@CurrentUser() user: SafeUser, @Body() dto: BidderProfilePatchDto) {
    return this.bidder.patchMyProfile(user, dto);
  }

  @Roles('bidder')
  @Post('me/profile/submit')
  submitMine(@CurrentUser() user: SafeUser) {
    return this.bidder.submit(user);
  }

  // -- Wallet (read-only for bidder) ----------------------------------------

  @Roles('bidder')
  @Get('me/wallet')
  async getMyWallet(@CurrentUser() user: SafeUser) {
    return this.wallet.getOrCreateByUserId(user.id);
  }

  @Roles('bidder')
  @Get('me/wallet/transactions')
  async listMyWalletTxns(
    @CurrentUser() user: SafeUser,
    @Query() query: Record<string, string>,
  ) {
    const parsed = walletTxnQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'invalid query');
    }
    const wallet = await this.wallet.getOrCreateByUserId(user.id);
    return this.wallet.listTransactions(wallet.bidderProfileId, parsed.data);
  }
}
