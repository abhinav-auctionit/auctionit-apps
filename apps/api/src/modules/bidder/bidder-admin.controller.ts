import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { bidderListQuerySchema, walletTxnQuerySchema, type BidderStatus } from '@auction/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { SafeUser } from '../auth/session.service';
import { BidderAdminService } from './bidder-admin.service';
import { WalletService } from './wallet.service';
import { BidderRejectDto } from './dto/bidder-reject.dto';
import { BidderMarkFeePaidDto } from './dto/bidder-mark-fee-paid.dto';
import { WalletCreditDto } from './dto/wallet-credit.dto';
import { WalletDebitDto } from './dto/wallet-debit.dto';

@ApiTags('admin/bidders')
@Roles('admin')
@Controller('admin/bidder-profiles')
export class BidderAdminController {
  constructor(
    private readonly admin: BidderAdminService,
    private readonly wallet: WalletService,
  ) {}

  @Get()
  list(@Query('status') status?: string) {
    const parsed = bidderListQuerySchema.safeParse({ status });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'invalid query');
    }
    return this.admin.list({ status: parsed.data.status as BidderStatus | undefined });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.findOne(id);
  }

  @Post(':id/mark-fee-paid')
  markFeePaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BidderMarkFeePaidDto,
  ) {
    return this.admin.markFeePaid(id, dto.note);
  }

  @Post(':id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.approve(id);
  }

  @Post(':id/reject')
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: BidderRejectDto) {
    return this.admin.reject(id, dto.note);
  }

  // -- Wallet ---------------------------------------------------------------

  @Get(':id/wallet')
  async getWallet(@Param('id', ParseUUIDPipe) id: string) {
    return this.wallet.getOrCreateByProfile(id);
  }

  @Get(':id/wallet/transactions')
  async listWalletTxns(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: Record<string, string>,
  ) {
    const parsed = walletTxnQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'invalid query');
    }
    return this.wallet.listTransactions(id, parsed.data);
  }

  @Post(':id/wallet/credit')
  async creditWallet(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WalletCreditDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.wallet.credit(id, {
      amount: dto.amount,
      note: dto.note,
      createdById: user.id,
    });
  }

  @Post(':id/wallet/debit')
  async debitWallet(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WalletDebitDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.wallet.debitCorrection(id, {
      amount: dto.amount,
      note: dto.note,
      createdById: user.id,
    });
  }
}
