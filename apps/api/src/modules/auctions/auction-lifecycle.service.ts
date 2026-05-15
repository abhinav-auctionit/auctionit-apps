import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type LotOutcomeStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../bidder/wallet.service';

const TERMINAL_OUTCOMES: LotOutcomeStatus[] = [
  'lifted',
  'forfeited',
  'rejected_by_client',
  'no_winner',
];

@Injectable()
export class AuctionLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  /**
   * End an auction. Computes the winner of each lot from the top bid, releases
   * non-winners' EMDs (lot-level) or marks their lot-participations released
   * (consolidated), and triggers consolidated settlement for any bidder whose
   * lots are now all terminal (e.g. they won zero lots).
   */
  async endAuction(auctionId: string, actorId: string | null) {
    return this.prisma.$transaction(
      async (tx) => {
        const auction = await tx.auction.findUnique({
          where: { id: auctionId },
          select: {
            id: true,
            status: true,
            consolidatedEmdAmount: true,
            lots: {
              select: {
                id: true,
                emdAmount: true,
                outcomeStatus: true,
              },
            },
          },
        });
        if (!auction) throw new NotFoundException('auction not found');
        if (auction.status === 'ended') return tx.auction.findUnique({ where: { id: auctionId } });
        if (auction.status !== 'scheduled' && auction.status !== 'live') {
          throw new ConflictException(`cannot end an auction in ${auction.status} state`);
        }

        // Status first — any racing bid path will see it and bail out.
        await tx.auction.update({ where: { id: auctionId }, data: { status: 'ended' } });

        for (const lot of auction.lots) {
          const topBid = await tx.bid.findFirst({
            where: { lotId: lot.id },
            orderBy: [{ amountCents: 'desc' }, { placedAt: 'asc' }],
            select: { bidderId: true, amountCents: true },
          });

          if (!topBid) {
            await tx.lot.update({
              where: { id: lot.id },
              data: {
                outcomeStatus: 'no_winner',
                winnerId: null,
                winningBidAmountCents: null,
              },
            });
            // All participants on this lot get released (no winner to retain).
            const participations = await tx.lotParticipation.findMany({
              where: { lotId: lot.id, releasedAt: null },
            });
            for (const p of participations) {
              await this.releaseParticipation(p, lot.id, tx, actorId);
            }
            continue;
          }

          // Map winner user → bidder profile.
          const winnerProfile = await tx.bidderProfile.findUnique({
            where: { userId: topBid.bidderId },
            select: { id: true },
          });

          await tx.lot.update({
            where: { id: lot.id },
            data: {
              outcomeStatus: 'pending_lift',
              winnerId: topBid.bidderId,
              winningBidAmountCents: topBid.amountCents,
            },
          });

          const participations = await tx.lotParticipation.findMany({
            where: { lotId: lot.id, releasedAt: null },
          });
          for (const p of participations) {
            const isWinner = winnerProfile?.id === p.bidderProfileId;
            if (isWinner) continue; // winner's EMD stays held until lift/forfeit/reject
            await this.releaseParticipation(p, lot.id, tx, actorId);
          }
        }

        // Anyone in consolidated mode whose lots are all already terminal
        // (e.g. they won zero) gets settled immediately.
        const aps = await tx.auctionParticipation.findMany({
          where: { auctionId, settledAt: null },
          select: { id: true, bidderProfileId: true },
        });
        for (const ap of aps) {
          await this.maybeSettleConsolidated(tx, auctionId, ap.bidderProfileId, actorId);
        }

        return tx.auction.findUnique({ where: { id: auctionId } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Cancel an auction. Releases every held EMD (lot-level + consolidated) and
   * flips status to cancelled.
   */
  async cancelAuction(auctionId: string, note: string | null, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const auction = await tx.auction.findUnique({
          where: { id: auctionId },
          select: { id: true, status: true },
        });
        if (!auction) throw new NotFoundException('auction not found');
        if (auction.status === 'cancelled')
          return tx.auction.findUnique({ where: { id: auctionId } });
        if (auction.status === 'ended') {
          throw new ConflictException('cannot cancel an auction that already ended');
        }

        await tx.auction.update({ where: { id: auctionId }, data: { status: 'cancelled' } });

        // Release all lot-level holds.
        const lotParts = await tx.lotParticipation.findMany({
          where: { lot: { auctionId }, releasedAt: null, emdHeldAmount: { gt: 0 } },
        });
        for (const p of lotParts) {
          await this.wallet.releaseEmd(
            p.bidderProfileId,
            {
              amount: p.emdHeldAmount,
              referenceType: 'lot',
              referenceId: p.lotId,
              note: note ?? 'Auction cancelled',
              createdById: actorId,
            },
            tx,
          );
          await tx.lotParticipation.update({
            where: { id: p.id },
            data: { releasedAt: new Date() },
          });
        }

        // Release consolidated holds.
        const aps = await tx.auctionParticipation.findMany({
          where: { auctionId, settledAt: null },
        });
        for (const ap of aps) {
          if (ap.consolidatedEmdHeldAmount > 0) {
            await this.wallet.releaseEmd(
              ap.bidderProfileId,
              {
                amount: ap.consolidatedEmdHeldAmount,
                referenceType: 'auction',
                referenceId: auctionId,
                note: note ?? 'Auction cancelled',
                createdById: actorId,
              },
              tx,
            );
          }
          await tx.auctionParticipation.update({
            where: { id: ap.id },
            data: {
              settledAt: new Date(),
              settlementRefundAmount: ap.consolidatedEmdHeldAmount,
              settlementForfeitAmount: 0,
            },
          });
        }

        return tx.auction.findUnique({ where: { id: auctionId } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async markLotLifted(auctionId: string, lotId: string, note: string | null, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const lot = await this.assertLotPendingLift(tx, auctionId, lotId);
        await tx.lot.update({
          where: { id: lotId },
          data: { outcomeStatus: 'lifted', liftedAt: new Date() },
        });
        const winnerProfile = await tx.bidderProfile.findFirst({
          where: { userId: lot.winnerId! },
          select: { id: true },
        });
        if (winnerProfile) {
          const winnerPart = await tx.lotParticipation.findUnique({
            where: {
              lotId_bidderProfileId: { lotId, bidderProfileId: winnerProfile.id },
            },
          });
          if (winnerPart && winnerPart.releasedAt === null && winnerPart.emdHeldAmount > 0) {
            // Lot-level mode: release the winner's lot EMD now that material is lifted.
            await this.wallet.releaseEmd(
              winnerProfile.id,
              {
                amount: winnerPart.emdHeldAmount,
                referenceType: 'lot',
                referenceId: lotId,
                note: note ?? 'Lot lifted by winner',
                createdById: actorId,
              },
              tx,
            );
            await tx.lotParticipation.update({
              where: { id: winnerPart.id },
              data: { releasedAt: new Date() },
            });
          }
          // Consolidated mode: maybe-settle if every lot is now terminal.
          await this.maybeSettleConsolidated(tx, auctionId, winnerProfile.id, actorId);
        }
        return tx.lot.findUnique({ where: { id: lotId } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async forfeitLot(auctionId: string, lotId: string, note: string | null, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const lot = await this.assertLotPendingLift(tx, auctionId, lotId);
        await tx.lot.update({
          where: { id: lotId },
          data: { outcomeStatus: 'forfeited', forfeitedAt: new Date() },
        });
        const winnerProfile = await tx.bidderProfile.findFirst({
          where: { userId: lot.winnerId! },
          select: { id: true },
        });
        if (winnerProfile) {
          const winnerPart = await tx.lotParticipation.findUnique({
            where: {
              lotId_bidderProfileId: { lotId, bidderProfileId: winnerProfile.id },
            },
          });
          if (winnerPart && winnerPart.releasedAt === null && winnerPart.emdHeldAmount > 0) {
            // Lot-level mode: forfeit the winner's lot EMD.
            await this.wallet.forfeitEmd(
              winnerProfile.id,
              {
                amount: winnerPart.emdHeldAmount,
                referenceType: 'lot',
                referenceId: lotId,
                note: note ?? 'Winner failed to lift material',
                createdById: actorId,
              },
              tx,
            );
            await tx.lotParticipation.update({
              where: { id: winnerPart.id },
              data: { releasedAt: new Date() },
            });
          }
          await this.maybeSettleConsolidated(tx, auctionId, winnerProfile.id, actorId);
        }
        return tx.lot.findUnique({ where: { id: lotId } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async rejectLotByClient(
    auctionId: string,
    lotId: string,
    note: string | null,
    actorId: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const lot = await this.assertLotPendingLift(tx, auctionId, lotId);
        await tx.lot.update({
          where: { id: lotId },
          data: { outcomeStatus: 'rejected_by_client', rejectedAt: new Date() },
        });
        const winnerProfile = await tx.bidderProfile.findFirst({
          where: { userId: lot.winnerId! },
          select: { id: true },
        });
        if (winnerProfile) {
          const winnerPart = await tx.lotParticipation.findUnique({
            where: {
              lotId_bidderProfileId: { lotId, bidderProfileId: winnerProfile.id },
            },
          });
          if (winnerPart && winnerPart.releasedAt === null && winnerPart.emdHeldAmount > 0) {
            // Lot-level: release immediately on client rejection.
            await this.wallet.releaseEmd(
              winnerProfile.id,
              {
                amount: winnerPart.emdHeldAmount,
                referenceType: 'lot',
                referenceId: lotId,
                note: note ?? 'Winner rejected by client',
                createdById: actorId,
              },
              tx,
            );
            await tx.lotParticipation.update({
              where: { id: winnerPart.id },
              data: { releasedAt: new Date() },
            });
          }
          // Consolidated: rejection treats this lot as "no charge"; settlement
          // computes refund when all lots terminate.
          await this.maybeSettleConsolidated(tx, auctionId, winnerProfile.id, actorId);
        }
        return tx.lot.findUnique({ where: { id: lotId } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Helper: release a single LotParticipation. If amount=0 (consolidated
   * permission row), just stamp releasedAt without a wallet movement.
   */
  private async releaseParticipation(
    p: { id: string; bidderProfileId: string; emdHeldAmount: number },
    lotId: string,
    tx: Prisma.TransactionClient,
    actorId: string | null,
  ) {
    if (p.emdHeldAmount > 0) {
      await this.wallet.releaseEmd(
        p.bidderProfileId,
        {
          amount: p.emdHeldAmount,
          referenceType: 'lot',
          referenceId: lotId,
          note: 'Auction ended — non-winner refund',
          createdById: actorId,
        },
        tx,
      );
    }
    await tx.lotParticipation.update({
      where: { id: p.id },
      data: { releasedAt: new Date() },
    });
  }

  private async assertLotPendingLift(
    tx: Prisma.TransactionClient,
    auctionId: string,
    lotId: string,
  ) {
    const lot = await tx.lot.findUnique({
      where: { id: lotId },
      select: {
        id: true,
        auctionId: true,
        winnerId: true,
        outcomeStatus: true,
        auction: { select: { status: true } },
      },
    });
    if (!lot || lot.auctionId !== auctionId) {
      throw new NotFoundException('lot not found in this auction');
    }
    if (lot.auction.status !== 'ended') {
      throw new ConflictException('auction must be ended before outcome actions');
    }
    if (lot.outcomeStatus !== 'pending_lift') {
      throw new ConflictException(
        `lot outcome already finalised (${lot.outcomeStatus ?? 'pending'})`,
      );
    }
    if (!lot.winnerId) {
      throw new BadRequestException('lot has no winner; cannot apply outcome action');
    }
    return lot;
  }

  /**
   * For a consolidated bidder: if every lot in the auction is now terminal,
   * compute and apply the consolidated settlement. Idempotent — does nothing
   * if already settled.
   *
   * Settlement rule (per user spec):
   *   forfeit = Σ lot.emdAmount over winner-of-forfeited lots (capped at held)
   *   refund  = held - forfeit
   * Lifted lots return their portion to the bidder via the consolidated refund.
   * Rejected and no-winner lots contribute zero either way.
   */
  private async maybeSettleConsolidated(
    tx: Prisma.TransactionClient,
    auctionId: string,
    bidderProfileId: string,
    actorId: string | null,
  ): Promise<boolean> {
    const ap = await tx.auctionParticipation.findUnique({
      where: { auctionId_bidderProfileId: { auctionId, bidderProfileId } },
    });
    if (!ap || ap.settledAt) return false;

    const lots = await tx.lot.findMany({
      where: { auctionId },
      select: {
        id: true,
        emdAmount: true,
        outcomeStatus: true,
        winnerId: true,
      },
    });
    const allTerminal = lots.every((l) =>
      TERMINAL_OUTCOMES.includes(l.outcomeStatus as LotOutcomeStatus),
    );
    if (!allTerminal) return false;

    const profile = await tx.bidderProfile.findUnique({
      where: { id: bidderProfileId },
      select: { userId: true },
    });
    if (!profile) return false;
    const winnerUserId = profile.userId;

    const forfeitSum = lots
      .filter((l) => l.outcomeStatus === 'forfeited' && l.winnerId === winnerUserId)
      .reduce((s, l) => s + l.emdAmount, 0);

    const held = ap.consolidatedEmdHeldAmount;
    const forfeit = Math.min(held, forfeitSum);
    const refund = held - forfeit;
    const shortfall = Math.max(0, forfeitSum - held);

    let settleForfeitTxnId: string | null = null;
    let settleRefundTxnId: string | null = null;

    if (forfeit > 0) {
      const result = await this.wallet.forfeitEmd(
        bidderProfileId,
        {
          amount: forfeit,
          referenceType: 'auction',
          referenceId: auctionId,
          note: 'Consolidated EMD forfeit for unlifted lots',
          createdById: actorId,
        },
        tx,
      );
      settleForfeitTxnId = result.transaction.id;
    }
    if (refund > 0) {
      const result = await this.wallet.releaseEmd(
        bidderProfileId,
        {
          amount: refund,
          referenceType: 'auction',
          referenceId: auctionId,
          note: 'Consolidated EMD refund after auction settlement',
          createdById: actorId,
        },
        tx,
      );
      settleRefundTxnId = result.transaction.id;
    }

    await tx.auctionParticipation.update({
      where: { id: ap.id },
      data: {
        settledAt: new Date(),
        settlementRefundAmount: refund,
        settlementForfeitAmount: forfeit,
        settlementShortfallAmount: shortfall,
        settleForfeitTxnId,
        settleRefundTxnId,
      },
    });
    return true;
  }
}
