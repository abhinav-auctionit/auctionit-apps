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

/**
 * A Prisma transaction client OR the base PrismaService. Methods that take this
 * compose into outer transactions (so participations + wallet move atomically)
 * but also work as standalone callers.
 */
type TxClient = Prisma.TransactionClient;

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
   * Admin wallet overview: every approved bidder with their balance + lockedBalance
   * (or zeros if no wallet row exists yet). One query — no N+1.
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
        wallet: { select: { balance: true, lockedBalance: true, updatedAt: true } },
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
      lockedBalance: p.wallet?.lockedBalance ?? 0,
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
    return this.applyBalanceDelta(bidderProfileId, +input.amount, {
      ...input,
      kind: input.kind ?? 'admin_credit',
    });
  }

  /** Admin correction. Always logs as admin_debit_correction unless overridden. */
  async debitCorrection(
    bidderProfileId: string,
    input: Omit<MutateInput, 'kind'>,
  ): Promise<MutateResult> {
    return this.applyBalanceDelta(bidderProfileId, -input.amount, {
      ...input,
      kind: 'admin_debit_correction',
    });
  }

  /**
   * Place a hold on EMD. Increments `lockedBalance` (which must not exceed
   * `balance`), writes an `emd_hold` ledger row. `balance` is unchanged —
   * total wallet money stays the same; just the available portion shrinks.
   *
   * Composable: pass `tx` to run inside an outer transaction.
   */
  async holdEmd(
    bidderProfileId: string,
    input: {
      amount: number;
      referenceType: string;
      referenceId: string;
      note?: string | null;
      createdById?: string | null;
    },
    tx?: TxClient,
  ): Promise<MutateResult> {
    return this.applyEmdMutation(
      bidderProfileId,
      {
        amount: input.amount,
        kind: 'emd_hold',
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        note: input.note ?? null,
        createdById: input.createdById ?? null,
      },
      (wallet) => {
        const newAvailable = wallet.balance - (wallet.lockedBalance + input.amount);
        if (newAvailable < 0) {
          const available = wallet.balance - wallet.lockedBalance;
          throw new ConflictException(
            `insufficient available balance: have ${available}, need ${input.amount}`,
          );
        }
        return {
          balance: wallet.balance,
          lockedBalance: wallet.lockedBalance + input.amount,
        };
      },
      tx,
    );
  }

  /**
   * Release a previously-held EMD. Decrements `lockedBalance`; `balance`
   * unchanged. Money returns to spendable.
   */
  async releaseEmd(
    bidderProfileId: string,
    input: {
      amount: number;
      referenceType: string;
      referenceId: string;
      note?: string | null;
      createdById?: string | null;
    },
    tx?: TxClient,
  ): Promise<MutateResult> {
    return this.applyEmdMutation(
      bidderProfileId,
      {
        amount: input.amount,
        kind: 'emd_release',
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        note: input.note ?? null,
        createdById: input.createdById ?? null,
      },
      (wallet) => {
        if (wallet.lockedBalance < input.amount) {
          throw new ConflictException(
            `cannot release more than locked: locked=${wallet.lockedBalance}, requested=${input.amount}`,
          );
        }
        return {
          balance: wallet.balance,
          lockedBalance: wallet.lockedBalance - input.amount,
        };
      },
      tx,
    );
  }

  /**
   * Forfeit a held EMD. Decrements both `lockedBalance` and `balance`. The
   * money leaves the wallet permanently.
   */
  async forfeitEmd(
    bidderProfileId: string,
    input: {
      amount: number;
      referenceType: string;
      referenceId: string;
      note?: string | null;
      createdById?: string | null;
    },
    tx?: TxClient,
  ): Promise<MutateResult> {
    return this.applyEmdMutation(
      bidderProfileId,
      {
        amount: input.amount,
        kind: 'emd_forfeit',
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        note: input.note ?? null,
        createdById: input.createdById ?? null,
      },
      (wallet) => {
        if (wallet.lockedBalance < input.amount) {
          throw new ConflictException(
            `cannot forfeit more than locked: locked=${wallet.lockedBalance}, requested=${input.amount}`,
          );
        }
        return {
          balance: wallet.balance - input.amount,
          lockedBalance: wallet.lockedBalance - input.amount,
        };
      },
      tx,
    );
  }

  private validateAmount(amount: number) {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('amount must be a positive whole number of rupees');
    }
    if (amount > MAX_AMOUNT) {
      throw new BadRequestException(`amount exceeds limit of ${MAX_AMOUNT}`);
    }
  }

  /**
   * Balance-only mutations (admin credit/debit correction): change `balance`,
   * leave `lockedBalance` alone. Single Serializable transaction.
   */
  private async applyBalanceDelta(
    bidderProfileId: string,
    signedDelta: number,
    input: MutateInput,
  ): Promise<MutateResult> {
    const magnitude = Math.abs(signedDelta);
    this.validateAmount(magnitude);

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
        if (newBalance < wallet.lockedBalance) {
          throw new ConflictException(
            `cannot debit below locked balance: locked=${wallet.lockedBalance}`,
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

  /**
   * Generic EMD mutation: caller provides a function that computes new
   * { balance, lockedBalance } from the current wallet (and validates).
   * Writes a ledger row recording the magnitude as `amount` and the
   * new `balance` as `balanceAfter`. Runs in caller's tx if provided.
   */
  private async applyEmdMutation(
    bidderProfileId: string,
    input: MutateInput,
    compute: (w: BidderWallet) => { balance: number; lockedBalance: number },
    outerTx?: TxClient,
  ): Promise<MutateResult> {
    this.validateAmount(input.amount);

    const exec = async (tx: TxClient): Promise<MutateResult> => {
      const wallet = await tx.bidderWallet.upsert({
        where: { bidderProfileId },
        update: {},
        create: { bidderProfileId },
      });
      const next = compute(wallet);
      const updated = await tx.bidderWallet.update({
        where: { id: wallet.id },
        data: { balance: next.balance, lockedBalance: next.lockedBalance },
      });
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          kind: input.kind,
          amount: input.amount,
          balanceAfter: next.balance,
          referenceType: input.referenceType ?? null,
          referenceId: input.referenceId ?? null,
          note: input.note?.trim() ? input.note.trim() : null,
          createdById: input.createdById ?? null,
        },
      });
      return { wallet: updated, transaction };
    };

    if (outerTx) return exec(outerTx);
    return this.prisma.$transaction<MutateResult>(exec, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }
}
