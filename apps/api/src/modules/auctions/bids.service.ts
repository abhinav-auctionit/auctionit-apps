import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { LotState, PlaceBidResult } from '@auction/types';
import { PrismaService } from '../../prisma/prisma.service';

const RECENT_BIDS_LIMIT = 20;

const IDEMPOTENCY_WINDOW_MS = 10_000;

@Injectable()
export class BidsService {
  constructor(private readonly prisma: PrismaService) {}

  async placeBid(
    auctionId: string,
    lotId: string,
    bidderUserId: string,
    input: { amountCents: number; idempotencyKey?: string },
  ): Promise<PlaceBidResult> {
    const profile = await this.prisma.bidderProfile.findUnique({
      where: { userId: bidderUserId },
      select: { id: true, status: true },
    });
    if (!profile) throw new ForbiddenException('no bidder profile');
    if (profile.status !== 'approved') {
      throw new ForbiddenException(`bidder profile is ${profile.status}`);
    }

    return this.prisma.$transaction(
      async (tx) => {
        const lockedRows = await tx.$queryRaw<
          Array<{
            id: string;
            auction_id: string;
            start_time: Date;
            end_time: Date;
            starting_price_cents: number;
            bid_increment_cents: number;
            current_bid_cents: number | null;
            current_bidder_id: string | null;
            bid_count: number;
          }>
        >`
          SELECT id, auction_id, start_time, end_time, starting_price_cents,
                 bid_increment_cents, current_bid_cents, current_bidder_id, bid_count
          FROM lots
          WHERE id = ${lotId}::uuid
          FOR UPDATE
        `;
        const lot = lockedRows[0];
        if (!lot) throw new NotFoundException('lot not found');
        if (lot.auction_id !== auctionId) {
          throw new BadRequestException('lot does not belong to this auction');
        }

        const auction = await tx.auction.findUnique({
          where: { id: auctionId },
          select: { status: true, auctionType: true },
        });
        if (!auction) throw new NotFoundException('auction not found');
        if (auction.auctionType !== 'forward') {
          throw new BadRequestException(
            `bidding on ${auction.auctionType} auctions is not yet supported`,
          );
        }
        // Allow bids while the lot is in its time window even if the
        // scheduler hasn't yet flipped status to 'live' — the scheduler is a
        // future task. Reject draft / cancelled / ended outright.
        if (auction.status === 'draft') {
          throw new ConflictException('auction is still a draft');
        }
        if (auction.status === 'cancelled' || auction.status === 'ended') {
          throw new ConflictException(`auction is ${auction.status}`);
        }

        const now = new Date();
        if (now < lot.start_time) {
          throw new ConflictException('lot has not started yet');
        }
        if (now >= lot.end_time) {
          throw new ConflictException('lot has ended');
        }

        const participation = await tx.lotParticipation.findUnique({
          where: { lotId_bidderProfileId: { lotId, bidderProfileId: profile.id } },
          select: { id: true, releasedAt: true },
        });
        if (!participation || participation.releasedAt !== null) {
          throw new ForbiddenException('not attached to this lot');
        }

        if (input.idempotencyKey) {
          const recent = await tx.bid.findFirst({
            where: {
              lotId,
              bidderId: bidderUserId,
              amountCents: input.amountCents,
              placedAt: { gte: new Date(now.getTime() - IDEMPOTENCY_WINDOW_MS) },
            },
            orderBy: { placedAt: 'desc' },
          });
          if (recent) {
            return {
              bid: {
                id: recent.id,
                lotId: recent.lotId,
                bidderId: recent.bidderId,
                amountCents: recent.amountCents,
                placedAt: recent.placedAt.toISOString(),
              },
              lot: {
                id: lot.id,
                currentBidCents: lot.current_bid_cents ?? recent.amountCents,
                currentBidderId: lot.current_bidder_id ?? recent.bidderId,
                currentBidPlacedAt: recent.placedAt.toISOString(),
                bidCount: lot.bid_count,
                endTime: lot.end_time.toISOString(),
              },
            };
          }
        }

        const minNext =
          lot.current_bid_cents === null
            ? lot.starting_price_cents
            : lot.current_bid_cents + lot.bid_increment_cents;
        if (input.amountCents < minNext) {
          throw new BadRequestException(
            `bid must be at least ${minNext} cents (current ${
              lot.current_bid_cents ?? 'none'
            }, increment ${lot.bid_increment_cents})`,
          );
        }
        if (
          lot.current_bidder_id !== null &&
          lot.current_bidder_id === bidderUserId
        ) {
          throw new ConflictException('you are already the highest bidder');
        }

        const bid = await tx.bid.create({
          data: {
            lotId,
            bidderId: bidderUserId,
            amountCents: input.amountCents,
            placedAt: now,
          },
        });
        await tx.lot.update({
          where: { id: lotId },
          data: {
            currentBidCents: input.amountCents,
            currentBidderId: bidderUserId,
            currentBidPlacedAt: now,
            bidCount: { increment: 1 },
          },
        });

        return {
          bid: {
            id: bid.id,
            lotId: bid.lotId,
            bidderId: bid.bidderId,
            amountCents: bid.amountCents,
            placedAt: bid.placedAt.toISOString(),
          },
          lot: {
            id: lot.id,
            currentBidCents: input.amountCents,
            currentBidderId: bidderUserId,
            currentBidPlacedAt: now.toISOString(),
            bidCount: lot.bid_count + 1,
            endTime: lot.end_time.toISOString(),
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async getLotState(
    auctionId: string,
    lotId: string,
    bidderUserId: string,
  ): Promise<LotState> {
    const lot = await this.prisma.lot.findUnique({
      where: { id: lotId },
      include: {
        auction: {
          select: { id: true, code: true, name: true, status: true, auctionType: true },
        },
      },
    });
    if (!lot) throw new NotFoundException('lot not found');
    if (lot.auctionId !== auctionId) {
      throw new BadRequestException('lot does not belong to this auction');
    }

    const profile = await this.prisma.bidderProfile.findUnique({
      where: { userId: bidderUserId },
      select: { id: true },
    });

    const participation = profile
      ? await this.prisma.lotParticipation.findUnique({
          where: {
            lotId_bidderProfileId: { lotId, bidderProfileId: profile.id },
          },
          select: { emdHeldAmount: true, releasedAt: true },
        })
      : null;
    const isAttached = !!(participation && participation.releasedAt === null);
    const emdHeldAmount = participation?.emdHeldAmount ?? 0;

    const recent = await this.prisma.bid.findMany({
      where: { lotId },
      orderBy: { placedAt: 'desc' },
      take: RECENT_BIDS_LIMIT,
      select: { id: true, bidderId: true, amountCents: true, placedAt: true },
    });

    const yourLast = recent.find((b) => b.bidderId === bidderUserId) ?? null;

    const nextValidBidCents =
      lot.currentBidCents === null
        ? lot.startingPriceCents
        : lot.currentBidCents + lot.bidIncrementCents;

    return {
      serverTime: new Date().toISOString(),
      auction: {
        id: lot.auction.id,
        code: lot.auction.code,
        name: lot.auction.name,
        status: lot.auction.status,
        auctionType: lot.auction.auctionType,
      },
      lot: {
        id: lot.id,
        lotNo: lot.lotNo,
        itemName: lot.itemName,
        qty: lot.qty.toString(),
        uom: lot.uom,
        startTime: lot.startTime.toISOString(),
        endTime: lot.endTime.toISOString(),
        startingPriceCents: lot.startingPriceCents,
        bidIncrementCents: lot.bidIncrementCents,
        currentBidCents: lot.currentBidCents,
        currentBidderId: lot.currentBidderId,
        currentBidPlacedAt: lot.currentBidPlacedAt
          ? lot.currentBidPlacedAt.toISOString()
          : null,
        bidCount: lot.bidCount,
      },
      you: {
        isAttached,
        isCurrentHigh:
          lot.currentBidderId !== null && lot.currentBidderId === bidderUserId,
        yourLastBidAmount: yourLast?.amountCents ?? null,
        yourLastBidAt: yourLast?.placedAt.toISOString() ?? null,
        emdHeldAmount,
        nextValidBidCents,
      },
      recentBids: recent.map((b) => ({
        id: b.id,
        amountCents: b.amountCents,
        placedAt: b.placedAt.toISOString(),
        bidderHandle:
          b.bidderId === bidderUserId
            ? 'You'
            : `Bidder ${b.bidderId.slice(-4).toUpperCase()}`,
        isYou: b.bidderId === bidderUserId,
      })),
    };
  }
}
