import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../bidder/wallet.service';

export type AttachFailure = {
  bidderProfileId: string;
  reason: 'not_found' | 'not_approved' | 'insufficient_balance';
  message: string;
};

export type AttachResult = {
  created: number;
  skippedExisting: number;
  failures: AttachFailure[];
};

@Injectable()
export class ParticipantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  /**
   * Lot-level mode attach. Picks specific lots for each bidder; holds each
   * lot's `emdAmount` from the bidder's wallet. Skips (lot, bidder) pairs
   * that already exist. Collects per-bidder failures instead of aborting
   * the whole batch.
   */
  async attachToLots(
    auctionId: string,
    input: { bidderProfileIds: string[]; lotIds: string[] },
    attachedById: string,
  ): Promise<AttachResult> {
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      select: { id: true, status: true },
    });
    if (!auction) throw new NotFoundException('auction not found');
    if (auction.status === 'ended' || auction.status === 'cancelled') {
      throw new ConflictException(`cannot attach to ${auction.status} auction`);
    }

    const lots = await this.prisma.lot.findMany({
      where: { id: { in: input.lotIds }, auctionId },
      select: { id: true, emdAmount: true },
    });
    if (lots.length !== new Set(input.lotIds).size) {
      throw new BadRequestException('one or more lotIds do not belong to this auction');
    }

    const profiles = await this.prisma.bidderProfile.findMany({
      where: { id: { in: input.bidderProfileIds } },
      select: { id: true, status: true },
    });
    const profilesById = new Map(profiles.map((p) => [p.id, p]));

    const failures: AttachFailure[] = [];
    let created = 0;
    let skippedExisting = 0;

    for (const bidderProfileId of input.bidderProfileIds) {
      const profile = profilesById.get(bidderProfileId);
      if (!profile) {
        failures.push({
          bidderProfileId,
          reason: 'not_found',
          message: 'bidder profile not found',
        });
        continue;
      }
      if (profile.status !== 'approved') {
        failures.push({
          bidderProfileId,
          reason: 'not_approved',
          message: `bidder profile is ${profile.status}; only approved bidders can be attached`,
        });
        continue;
      }

      try {
        await this.prisma.$transaction(
          async (tx) => {
            // A bidder can only be in ONE mode per auction. If they're already
            // attached consolidated, refuse this lot-level attach.
            const consolidated = await tx.auctionParticipation.findUnique({
              where: {
                auctionId_bidderProfileId: { auctionId, bidderProfileId },
              },
              select: { id: true },
            });
            if (consolidated) {
              throw new ConflictException(
                'bidder is already attached in consolidated mode — detach from auction first',
              );
            }
            for (const lot of lots) {
              const existing = await tx.lotParticipation.findUnique({
                where: { lotId_bidderProfileId: { lotId: lot.id, bidderProfileId } },
                select: { id: true },
              });
              if (existing) {
                skippedExisting += 1;
                continue;
              }
              let holdTxnId: string | null = null;
              if (lot.emdAmount > 0) {
                const result = await this.wallet.holdEmd(
                  bidderProfileId,
                  {
                    amount: lot.emdAmount,
                    referenceType: 'lot',
                    referenceId: lot.id,
                    note: `EMD for lot participation`,
                    createdById: attachedById,
                  },
                  tx,
                );
                holdTxnId = result.transaction.id;
              }
              await tx.lotParticipation.create({
                data: {
                  lotId: lot.id,
                  bidderProfileId,
                  emdHeldAmount: lot.emdAmount,
                  attachedById,
                  holdTxnId,
                },
              });
              created += 1;
            }
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (err) {
        if (err instanceof ConflictException) {
          failures.push({
            bidderProfileId,
            reason: 'insufficient_balance',
            message: err.message,
          });
          continue;
        }
        throw err;
      }
    }

    return { created, skippedExisting, failures };
  }

  /**
   * Consolidated mode attach. Holds the auction's `consolidatedEmdAmount`
   * once per bidder, then creates a permission row (`LotParticipation` with
   * `emdHeldAmount = 0`) for every lot so bid validation stays uniform.
   */
  async attachToAuctionConsolidated(
    auctionId: string,
    input: { bidderProfileIds: string[] },
    attachedById: string,
  ): Promise<AttachResult> {
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      select: {
        id: true,
        status: true,
        consolidatedEmdAmount: true,
        lots: { select: { id: true } },
      },
    });
    if (!auction) throw new NotFoundException('auction not found');
    if (auction.status === 'ended' || auction.status === 'cancelled') {
      throw new ConflictException(`cannot attach to ${auction.status} auction`);
    }
    if (auction.consolidatedEmdAmount === null) {
      throw new BadRequestException(
        'this auction does not offer consolidated EMD',
      );
    }

    const profiles = await this.prisma.bidderProfile.findMany({
      where: { id: { in: input.bidderProfileIds } },
      select: { id: true, status: true },
    });
    const profilesById = new Map(profiles.map((p) => [p.id, p]));

    const failures: AttachFailure[] = [];
    let created = 0;
    let skippedExisting = 0;

    for (const bidderProfileId of input.bidderProfileIds) {
      const profile = profilesById.get(bidderProfileId);
      if (!profile) {
        failures.push({
          bidderProfileId,
          reason: 'not_found',
          message: 'bidder profile not found',
        });
        continue;
      }
      if (profile.status !== 'approved') {
        failures.push({
          bidderProfileId,
          reason: 'not_approved',
          message: `bidder profile is ${profile.status}; only approved bidders can be attached`,
        });
        continue;
      }

      try {
        await this.prisma.$transaction(
          async (tx) => {
            const existing = await tx.auctionParticipation.findUnique({
              where: { auctionId_bidderProfileId: { auctionId, bidderProfileId } },
              select: { id: true },
            });
            if (existing) {
              skippedExisting += 1;
              return;
            }
            // A bidder can only be in ONE mode per auction. If they already
            // have any lot-level participation (non-zero held), refuse.
            const lotLevel = await tx.lotParticipation.findFirst({
              where: {
                bidderProfileId,
                lot: { auctionId },
                emdHeldAmount: { gt: 0 },
              },
              select: { id: true },
            });
            if (lotLevel) {
              throw new ConflictException(
                'bidder is already attached in lot-level mode — detach from those lots first',
              );
            }
            let holdTxnId: string | null = null;
            const consolidated = auction.consolidatedEmdAmount!;
            if (consolidated > 0) {
              const result = await this.wallet.holdEmd(
                bidderProfileId,
                {
                  amount: consolidated,
                  referenceType: 'auction',
                  referenceId: auctionId,
                  note: 'Consolidated EMD for auction participation',
                  createdById: attachedById,
                },
                tx,
              );
              holdTxnId = result.transaction.id;
            }
            await tx.auctionParticipation.create({
              data: {
                auctionId,
                bidderProfileId,
                consolidatedEmdHeldAmount: consolidated,
                attachedById,
                holdTxnId,
              },
            });
            // 0-amount permission rows for every lot.
            if (auction.lots.length > 0) {
              await tx.lotParticipation.createMany({
                data: auction.lots.map((l) => ({
                  lotId: l.id,
                  bidderProfileId,
                  emdHeldAmount: 0,
                  attachedById,
                })),
                skipDuplicates: true,
              });
            }
            created += 1;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (err) {
        if (err instanceof ConflictException) {
          failures.push({
            bidderProfileId,
            reason: 'insufficient_balance',
            message: err.message,
          });
          continue;
        }
        throw err;
      }
    }

    return { created, skippedExisting, failures };
  }

  /**
   * Detach a bidder from a single lot. Blocked if the bidder has already
   * placed any bid on this lot. Releases the held EMD if any.
   */
  async detachFromLot(
    auctionId: string,
    lotId: string,
    bidderProfileId: string,
    actorId: string,
  ): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        const lot = await tx.lot.findUnique({
          where: { id: lotId },
          select: { auctionId: true, auction: { select: { status: true } } },
        });
        if (!lot || lot.auctionId !== auctionId) {
          throw new NotFoundException('lot not found in this auction');
        }
        if (lot.auction.status === 'ended' || lot.auction.status === 'cancelled') {
          throw new ConflictException(`cannot detach: auction is ${lot.auction.status}`);
        }
        const participation = await tx.lotParticipation.findUnique({
          where: { lotId_bidderProfileId: { lotId, bidderProfileId } },
        });
        if (!participation) {
          throw new NotFoundException('bidder is not attached to this lot');
        }
        const profile = await tx.bidderProfile.findUnique({
          where: { id: bidderProfileId },
          select: { userId: true },
        });
        if (profile) {
          const bidCount = await tx.bid.count({
            where: { lotId, bidderId: profile.userId },
          });
          if (bidCount > 0) {
            throw new ConflictException(
              'bidder has placed bids on this lot — cannot detach',
            );
          }
        }
        if (participation.emdHeldAmount > 0) {
          await this.wallet.releaseEmd(
            bidderProfileId,
            {
              amount: participation.emdHeldAmount,
              referenceType: 'lot',
              referenceId: lotId,
              note: 'Detached before auction ended',
              createdById: actorId,
            },
            tx,
          );
        }
        await tx.lotParticipation.delete({ where: { id: participation.id } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Consolidated wholesale detach: remove the bidder from the auction
   * entirely. Blocked if any bid exists across any lot. Releases the
   * consolidated EMD.
   */
  async detachFromAuction(
    auctionId: string,
    bidderProfileId: string,
    actorId: string,
  ): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        const auction = await tx.auction.findUnique({
          where: { id: auctionId },
          select: { status: true, consolidatedEmdAmount: true },
        });
        if (!auction) throw new NotFoundException('auction not found');
        if (auction.status === 'ended' || auction.status === 'cancelled') {
          throw new ConflictException(`cannot detach: auction is ${auction.status}`);
        }
        if (auction.consolidatedEmdAmount === null) {
          throw new BadRequestException(
            'this is a lot-level auction; detach each lot individually',
          );
        }
        const ap = await tx.auctionParticipation.findUnique({
          where: { auctionId_bidderProfileId: { auctionId, bidderProfileId } },
        });
        if (!ap) throw new NotFoundException('bidder is not attached to this auction');
        const profile = await tx.bidderProfile.findUnique({
          where: { id: bidderProfileId },
          select: { userId: true },
        });
        if (profile) {
          const bidCount = await tx.bid.count({
            where: { lot: { auctionId }, bidderId: profile.userId },
          });
          if (bidCount > 0) {
            throw new ConflictException(
              'bidder has placed bids on lots in this auction — cannot detach',
            );
          }
        }
        if (ap.consolidatedEmdHeldAmount > 0) {
          await this.wallet.releaseEmd(
            bidderProfileId,
            {
              amount: ap.consolidatedEmdHeldAmount,
              referenceType: 'auction',
              referenceId: auctionId,
              note: 'Detached before auction ended',
              createdById: actorId,
            },
            tx,
          );
        }
        await tx.lotParticipation.deleteMany({
          where: { bidderProfileId, lot: { auctionId } },
        });
        await tx.auctionParticipation.delete({ where: { id: ap.id } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async listParticipants(auctionId: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      select: {
        id: true,
        consolidatedEmdAmount: true,
        lots: { select: { id: true } },
      },
    });
    if (!auction) throw new NotFoundException('auction not found');

    const lotParts = await this.prisma.lotParticipation.findMany({
      where: { lot: { auctionId } },
      include: {
        lot: { select: { id: true, lotNo: true, itemName: true, emdAmount: true } },
        bidderProfile: {
          select: {
            id: true,
            fullName: true,
            companyName: true,
            contactCountryCode: true,
            contactNumber: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    const auctionParts = await this.prisma.auctionParticipation.findMany({
      where: { auctionId },
      include: {
        bidderProfile: {
          select: {
            id: true,
            fullName: true,
            companyName: true,
            contactCountryCode: true,
            contactNumber: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    // Bid counts per (lot, bidder) so the UI can disable the detach button
    // for bidders who have already placed bids.
    const bidCounts = await this.prisma.bid.groupBy({
      by: ['lotId', 'bidderId'],
      where: { lot: { auctionId } },
      _count: { _all: true },
    });
    const userIdsToProfile = new Map<string, string>();
    for (const part of lotParts) {
      userIdsToProfile.set(part.bidderProfile.user.id, part.bidderProfileId);
    }
    const hasBidByPair = new Map<string, boolean>();
    for (const bc of bidCounts) {
      const profileId = userIdsToProfile.get(bc.bidderId);
      if (profileId) hasBidByPair.set(`${bc.lotId}|${profileId}`, true);
    }

    type BidderEntry = {
      bidderProfileId: string;
      profile: {
        id: string;
        fullName: string;
        companyName: string | null;
        contactCountryCode: string;
        contactNumber: string;
        user: { id: string; name: string; email: string };
      };
      mode: 'lot' | 'consolidated';
      totalEmdHeld: number;
      consolidatedSettledAt: string | null;
      lots: Array<{
        lotId: string;
        lotNo: number;
        itemName: string;
        lotEmdAmount: number;
        emdHeldAmount: number;
        hasBid: boolean;
        attachedAt: string;
        releasedAt: string | null;
      }>;
      auctionParticipationId: string | null;
    };

    const byBidder = new Map<string, BidderEntry>();

    for (const ap of auctionParts) {
      byBidder.set(ap.bidderProfileId, {
        bidderProfileId: ap.bidderProfileId,
        profile: ap.bidderProfile,
        mode: 'consolidated',
        totalEmdHeld: ap.consolidatedEmdHeldAmount,
        consolidatedSettledAt: ap.settledAt ? ap.settledAt.toISOString() : null,
        lots: [],
        auctionParticipationId: ap.id,
      });
    }

    for (const lp of lotParts) {
      let entry = byBidder.get(lp.bidderProfileId);
      if (!entry) {
        entry = {
          bidderProfileId: lp.bidderProfileId,
          profile: lp.bidderProfile,
          mode: 'lot',
          totalEmdHeld: 0,
          consolidatedSettledAt: null,
          lots: [],
          auctionParticipationId: null,
        };
        byBidder.set(lp.bidderProfileId, entry);
      }
      const hasBid = hasBidByPair.get(`${lp.lotId}|${lp.bidderProfileId}`) ?? false;
      entry.lots.push({
        lotId: lp.lotId,
        lotNo: lp.lot.lotNo,
        itemName: lp.lot.itemName,
        lotEmdAmount: lp.lot.emdAmount,
        emdHeldAmount: lp.emdHeldAmount,
        hasBid,
        attachedAt: lp.attachedAt.toISOString(),
        releasedAt: lp.releasedAt ? lp.releasedAt.toISOString() : null,
      });
      if (entry.mode === 'lot') {
        entry.totalEmdHeld += lp.emdHeldAmount;
      }
    }

    return {
      consolidatedAvailable: auction.consolidatedEmdAmount !== null,
      consolidatedAmount: auction.consolidatedEmdAmount,
      bidders: Array.from(byBidder.values()).sort((a, b) =>
        a.profile.fullName.localeCompare(b.profile.fullName),
      ),
    };
  }

  async searchBidders(query: string, excludeAttachedTo?: string) {
    const q = query.trim();
    if (q.length === 0) return [];
    const where: Prisma.BidderProfileWhereInput = {
      status: 'approved',
      OR: [
        { fullName: { contains: q, mode: 'insensitive' } },
        { companyName: { contains: q, mode: 'insensitive' } },
        { contactNumber: { contains: q } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ],
    };
    const profiles = await this.prisma.bidderProfile.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        companyName: true,
        contactCountryCode: true,
        contactNumber: true,
        user: { select: { id: true, name: true, email: true } },
        wallet: { select: { balance: true, lockedBalance: true } },
      },
      orderBy: { fullName: 'asc' },
      take: 50,
    });

    if (!excludeAttachedTo) return profiles;

    // Filter out bidders already attached to this auction (either via
    // consolidated or via any lot).
    const attached = await this.prisma.bidderProfile.findMany({
      where: {
        OR: [
          { auctionParticipations: { some: { auctionId: excludeAttachedTo } } },
          { lotParticipations: { some: { lot: { auctionId: excludeAttachedTo } } } },
        ],
      },
      select: { id: true },
    });
    const attachedIds = new Set(attached.map((p) => p.id));
    return profiles.filter((p) => !attachedIds.has(p.id));
  }
}
