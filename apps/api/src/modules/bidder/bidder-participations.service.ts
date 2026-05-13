import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Read-only views for a bidder: which auctions am I attached to, and what
 * does my participation look like in a specific one. Replaces the old
 * invitation-driven listings.
 */
@Injectable()
export class BidderParticipationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMyAuctions(userId: string) {
    const profile = await this.prisma.bidderProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) return [];

    // Distinct auctions reached via any LotParticipation.
    const lotParts = await this.prisma.lotParticipation.findMany({
      where: { bidderProfileId: profile.id },
      select: {
        emdHeldAmount: true,
        releasedAt: true,
        lot: {
          select: {
            auctionId: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    const auctionParts = await this.prisma.auctionParticipation.findMany({
      where: { bidderProfileId: profile.id },
      select: {
        auctionId: true,
        consolidatedEmdHeldAmount: true,
        settledAt: true,
      },
    });
    const consolidatedById = new Map(auctionParts.map((a) => [a.auctionId, a]));

    type Summary = {
      auctionId: string;
      lotCount: number;
      totalEmdHeld: number;
      earliestStartTime: Date | null;
      latestEndTime: Date | null;
      isConsolidated: boolean;
      consolidatedSettledAt: Date | null;
    };
    const byAuction = new Map<string, Summary>();
    for (const lp of lotParts) {
      const cur = byAuction.get(lp.lot.auctionId) ?? {
        auctionId: lp.lot.auctionId,
        lotCount: 0,
        totalEmdHeld: 0,
        earliestStartTime: null as Date | null,
        latestEndTime: null as Date | null,
        isConsolidated: false,
        consolidatedSettledAt: null as Date | null,
      };
      cur.lotCount += 1;
      // emd_held = 0 in consolidated mode; consolidated portion contributed separately below
      if (lp.releasedAt === null) cur.totalEmdHeld += lp.emdHeldAmount;
      if (!cur.earliestStartTime || lp.lot.startTime < cur.earliestStartTime) {
        cur.earliestStartTime = lp.lot.startTime;
      }
      if (!cur.latestEndTime || lp.lot.endTime > cur.latestEndTime) {
        cur.latestEndTime = lp.lot.endTime;
      }
      byAuction.set(lp.lot.auctionId, cur);
    }
    for (const ap of auctionParts) {
      const cur = byAuction.get(ap.auctionId) ?? {
        auctionId: ap.auctionId,
        lotCount: 0,
        totalEmdHeld: 0,
        earliestStartTime: null as Date | null,
        latestEndTime: null as Date | null,
        isConsolidated: false,
        consolidatedSettledAt: null as Date | null,
      };
      cur.isConsolidated = true;
      cur.consolidatedSettledAt = ap.settledAt;
      if (!ap.settledAt) cur.totalEmdHeld += ap.consolidatedEmdHeldAmount;
      byAuction.set(ap.auctionId, cur);
    }

    if (byAuction.size === 0) return [];

    const auctions = await this.prisma.auction.findMany({
      where: { id: { in: Array.from(byAuction.keys()) } },
      select: {
        id: true,
        code: true,
        name: true,
        auctionType: true,
        status: true,
        consolidatedEmdAmount: true,
        client: { select: { id: true, companyName: true } },
      },
    });

    return auctions
      .map((a) => {
        const s = byAuction.get(a.id)!;
        return {
          id: a.id,
          code: a.code,
          name: a.name,
          auctionType: a.auctionType,
          status: a.status,
          consolidatedEmdAmount: a.consolidatedEmdAmount,
          client: a.client,
          mode: s.isConsolidated ? ('consolidated' as const) : ('lot' as const),
          lotCount: s.lotCount,
          totalEmdHeld: s.totalEmdHeld,
          earliestStartTime: s.earliestStartTime?.toISOString() ?? null,
          latestEndTime: s.latestEndTime?.toISOString() ?? null,
          consolidatedSettledAt: s.consolidatedSettledAt?.toISOString() ?? null,
        };
      })
      .sort((a, b) => {
        // Live first, then scheduled (by start time asc), then ended (by end desc).
        const order = (s: string) => (s === 'live' ? 0 : s === 'scheduled' ? 1 : 2);
        if (order(a.status) !== order(b.status)) return order(a.status) - order(b.status);
        return (b.latestEndTime ?? '').localeCompare(a.latestEndTime ?? '');
      });
  }

  async getMyAuction(userId: string, auctionId: string) {
    const profile = await this.prisma.bidderProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('bidder profile not found');

    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      select: {
        id: true,
        code: true,
        name: true,
        auctionType: true,
        status: true,
        consolidatedEmdAmount: true,
        description: true,
        client: { select: { id: true, companyName: true } },
        location: { select: { id: true, name: true, city: true, state: true } },
      },
    });
    if (!auction) throw new NotFoundException('auction not found');

    const ap = await this.prisma.auctionParticipation.findUnique({
      where: {
        auctionId_bidderProfileId: { auctionId, bidderProfileId: profile.id },
      },
    });
    const lotParts = await this.prisma.lotParticipation.findMany({
      where: { bidderProfileId: profile.id, lot: { auctionId } },
      include: {
        lot: {
          select: {
            id: true,
            lotNo: true,
            itemName: true,
            description: true,
            qty: true,
            uom: true,
            startTime: true,
            endTime: true,
            startingPriceCents: true,
            bidIncrementCents: true,
            emdAmount: true,
            winnerId: true,
            winningBidAmountCents: true,
            outcomeStatus: true,
          },
        },
      },
    });

    if (lotParts.length === 0 && !ap) {
      throw new NotFoundException('you are not attached to this auction');
    }

    return {
      auction,
      mode: ap ? ('consolidated' as const) : ('lot' as const),
      consolidated: ap
        ? {
            heldAmount: ap.consolidatedEmdHeldAmount,
            settledAt: ap.settledAt?.toISOString() ?? null,
            settlementRefundAmount: ap.settlementRefundAmount,
            settlementForfeitAmount: ap.settlementForfeitAmount,
            settlementShortfallAmount: ap.settlementShortfallAmount,
          }
        : null,
      lots: lotParts
        .map((lp) => ({
          lotId: lp.lot.id,
          lotNo: lp.lot.lotNo,
          itemName: lp.lot.itemName,
          description: lp.lot.description,
          qty: lp.lot.qty.toString(),
          uom: lp.lot.uom,
          startTime: lp.lot.startTime.toISOString(),
          endTime: lp.lot.endTime.toISOString(),
          startingPriceCents: lp.lot.startingPriceCents,
          bidIncrementCents: lp.lot.bidIncrementCents,
          lotEmdAmount: lp.lot.emdAmount,
          emdHeldAmount: lp.emdHeldAmount,
          attachedAt: lp.attachedAt.toISOString(),
          releasedAt: lp.releasedAt?.toISOString() ?? null,
          outcomeStatus: lp.lot.outcomeStatus,
          isWinner:
            lp.lot.winnerId != null &&
            // winnerId references User.id; match against this profile's userId
            lp.lot.winnerId === userId,
          winningBidAmountCents: lp.lot.winningBidAmountCents,
        }))
        .sort((a, b) => a.lotNo - b.lotNo),
    };
  }
}
