import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const LIST_INCLUDE = {
  auction: {
    select: {
      id: true,
      code: true,
      name: true,
      auctionType: true,
      status: true,
      emdAmount: true,
      description: true,
      client: { select: { id: true, companyName: true } },
      lots: {
        orderBy: { startTime: 'asc' as const },
        select: {
          id: true,
          lotNo: true,
          itemName: true,
          qty: true,
          uom: true,
          auctionDate: true,
          startTime: true,
          endTime: true,
          startingPriceCents: true,
          bidIncrementCents: true,
        },
      },
    },
  },
} satisfies Prisma.AuctionInvitationInclude;

@Injectable()
export class BidderInvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Find the bidder profile for a user, throwing if missing. */
  private async profileForUser(userId: string) {
    const profile = await this.prisma.bidderProfile.findUnique({
      where: { userId },
      select: { id: true, status: true },
    });
    if (!profile) throw new NotFoundException('bidder profile not found');
    return profile;
  }

  async listInvitations(userId: string) {
    const profile = await this.profileForUser(userId);
    return this.prisma.auctionInvitation.findMany({
      where: { bidderProfileId: profile.id },
      include: LIST_INCLUDE,
      orderBy: { invitedAt: 'desc' },
    });
  }

  async getInvitedAuction(userId: string, auctionId: string) {
    const profile = await this.profileForUser(userId);
    const invitation = await this.prisma.auctionInvitation.findUnique({
      where: {
        auctionId_bidderProfileId: { auctionId, bidderProfileId: profile.id },
      },
      include: LIST_INCLUDE,
    });
    if (!invitation) {
      throw new ForbiddenException('you are not invited to this auction');
    }
    return invitation;
  }

  /**
   * Join an auction: validate, debit EMD from the bidder's wallet, mark
   * joinedAt on the invitation. All three operations run in one Serializable
   * transaction so the balance + ledger + invitation can't drift on failure.
   */
  async joinAuction(userId: string, auctionId: string) {
    const profile = await this.profileForUser(userId);
    if (profile.status !== 'approved') {
      throw new ForbiddenException(
        'bidder profile must be approved before joining auctions',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        const invitation = await tx.auctionInvitation.findUnique({
          where: {
            auctionId_bidderProfileId: {
              auctionId,
              bidderProfileId: profile.id,
            },
          },
          include: { auction: true },
        });
        if (!invitation) {
          throw new ForbiddenException('you are not invited to this auction');
        }
        if (invitation.joinedAt) {
          throw new ConflictException('you have already joined this auction');
        }
        if (
          invitation.auction.status === 'ended' ||
          invitation.auction.status === 'cancelled'
        ) {
          throw new BadRequestException(
            `auction is ${invitation.auction.status} and no longer accepts participants`,
          );
        }

        const emd = invitation.auction.emdAmount;
        if (emd > 0) {
          const wallet = await tx.bidderWallet.upsert({
            where: { bidderProfileId: profile.id },
            update: {},
            create: { bidderProfileId: profile.id },
          });
          if (wallet.balance < emd) {
            throw new ConflictException(
              `insufficient wallet balance: have ₹${wallet.balance}, need ₹${emd}`,
            );
          }
          const newBalance = wallet.balance - emd;
          await tx.bidderWallet.update({
            where: { id: wallet.id },
            data: { balance: newBalance },
          });
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              kind: 'emd_debit',
              amount: emd,
              balanceAfter: newBalance,
              referenceType: 'auction',
              referenceId: auctionId,
              note: `EMD for auction ${invitation.auction.code}`,
            },
          });
        }

        return tx.auctionInvitation.update({
          where: { id: invitation.id },
          data: { joinedAt: new Date() },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
