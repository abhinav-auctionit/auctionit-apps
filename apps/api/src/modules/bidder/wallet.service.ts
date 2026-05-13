import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { BidderWallet, WalletTransaction, WalletTxnKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const MAX_AMOUNT = 100_000_000; // ₹10 crore — guard against typos.

interface MutateInput {
  amount: number;
  note?: string | null;
  kind: WalletTxnKind;
  createdById?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
}

export interface MutateResult {
  wallet: BidderWallet;
  transaction: WalletTransaction;
}

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateByProfile(bidderProfileId: string): Promise<BidderWallet> {
    return this.prisma.bidderWallet.upsert({
      where: { bidderProfileId },
      update: {},
      create: { bidderProfileId },
    });
  }

  /**
   * Admin wallet overview: every approved bidder with their balance (or 0
   * if no wallet row exists yet). One query — no N+1.
   */
  async listAllWallets() {
    const profiles = await this.prisma.bidderProfile.findMany({
      where: { status: 'approved' },
      select: {
        id: true,
        fullName: true,
        companyName: true,
        contactCountryCode: true,
        contactNumber: true,
        user: { select: { id: true, name: true, email: true } },
        wallet: { select: { balance: true, updatedAt: true } },
      },
      orderBy: { fullName: 'asc' },
    });
    return profiles.map((p) => ({
      profileId: p.id,
      fullName: p.fullName,
      companyName: p.companyName,
      contactCountryCode: p.contactCountryCode,
      contactNumber: p.contactNumber,
      user: p.user,
      balance: p.wallet?.balance ?? 0,
      walletUpdatedAt: p.wallet?.updatedAt ?? null,
    }));
  }

  async getOrCreateByUserId(userId: string): Promise<BidderWallet> {
    const profile = await this.prisma.bidderProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('bidder profile not found');
    return this.getOrCreateByProfile(profile.id);
  }

  async listTransactions(
    bidderProfileId: string,
    opts: { limit?: number; before?: Date } = {},
  ) {
    const wallet = await this.getOrCreateByProfile(bidderProfileId);
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    return this.prisma.walletTransaction.findMany({
      where: {
        walletId: wallet.id,
        ...(opts.before ? { createdAt: { lt: opts.before } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /** Admin top-up. Caller passes adminId via createdById. */
  async credit(
    bidderProfileId: string,
    input: Omit<MutateInput, 'kind'> & { kind?: WalletTxnKind },
  ): Promise<MutateResult> {
    return this.applyDelta(bidderProfileId, +input.amount, {
      ...input,
      kind: input.kind ?? 'admin_credit',
    });
  }

  /** Admin correction. Always logs as admin_debit_correction unless overridden. */
  async debitCorrection(
    bidderProfileId: string,
    input: Omit<MutateInput, 'kind'>,
  ): Promise<MutateResult> {
    return this.applyDelta(bidderProfileId, -input.amount, {
      ...input,
      kind: 'admin_debit_correction',
    });
  }

  /** Hook for the future "join auction" flow. Atomic check + debit. */
  async debitForEmd(
    bidderProfileId: string,
    auctionId: string,
    amount: number,
  ): Promise<MutateResult> {
    return this.applyDelta(bidderProfileId, -amount, {
      amount,
      kind: 'emd_debit',
      referenceType: 'auction',
      referenceId: auctionId,
      note: 'EMD for auction participation',
    });
  }

  /** Hook for auction-end refund (loser, withdrawn, cancelled). */
  async refundEmd(
    bidderProfileId: string,
    auctionId: string,
    amount: number,
  ): Promise<MutateResult> {
    return this.applyDelta(bidderProfileId, +amount, {
      amount,
      kind: 'emd_refund',
      referenceType: 'auction',
      referenceId: auctionId,
      note: 'EMD refund',
    });
  }

  /**
   * Single point that mutates wallet balance and writes a ledger row.
   * `signedDelta` is the actual change (positive credit, negative debit);
   * `input.amount` is always positive (the magnitude — sign comes from kind).
   */
  private async applyDelta(
    bidderProfileId: string,
    signedDelta: number,
    input: MutateInput,
  ): Promise<MutateResult> {
    const magnitude = Math.abs(signedDelta);
    if (!Number.isInteger(magnitude) || magnitude <= 0) {
      throw new BadRequestException('amount must be a positive whole number of rupees');
    }
    if (magnitude > MAX_AMOUNT) {
      throw new BadRequestException(`amount exceeds limit of ${MAX_AMOUNT}`);
    }

    return this.prisma.$transaction<MutateResult>(
      async (tx) => {
        const wallet = await tx.bidderWallet.upsert({
          where: { bidderProfileId },
          update: {},
          create: { bidderProfileId },
        });
        const newBalance = wallet.balance + signedDelta;
        if (newBalance < 0) {
          throw new ConflictException(
            `insufficient balance: have ${wallet.balance}, need ${magnitude}`,
          );
        }
        const updated = await tx.bidderWallet.update({
          where: { id: wallet.id },
          data: { balance: newBalance },
        });
        const transaction = await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            kind: input.kind,
            amount: magnitude,
            balanceAfter: newBalance,
            referenceType: input.referenceType ?? null,
            referenceId: input.referenceId ?? null,
            note: input.note?.trim() ? input.note.trim() : null,
            createdById: input.createdById ?? null,
          },
        });
        return { wallet: updated, transaction };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
