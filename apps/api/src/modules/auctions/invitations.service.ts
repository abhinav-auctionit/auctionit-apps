import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { AuctionInvitation, BidderProfile, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfig } from '../../config/app-config.service';
import { SMS_SERVICE, type SmsService } from '../sms/sms.service';

const INVITATION_INCLUDE = {
  bidderProfile: {
    select: {
      id: true,
      fullName: true,
      contactCountryCode: true,
      contactNumber: true,
      companyName: true,
      status: true,
      user: { select: { id: true, email: true, name: true } },
    },
  },
  invitedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.AuctionInvitationInclude;

export interface InviteSummary {
  requested: number;
  created: number;
  skippedExisting: number;
  notSent: number;
  sent: number;
  failed: number;
  notFound: string[];
}

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    @Inject(SMS_SERVICE) private readonly sms: SmsService,
  ) {}

  async list(auctionId: string) {
    return this.prisma.auctionInvitation.findMany({
      where: { auctionId },
      include: INVITATION_INCLUDE,
      orderBy: { invitedAt: 'desc' },
    });
  }

  async invite(
    auctionId: string,
    bidderProfileIds: string[],
    invitedById: string,
  ): Promise<{ summary: InviteSummary; invitations: AuctionInvitation[] }> {
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      select: { id: true, status: true, code: true, name: true },
    });
    if (!auction) throw new NotFoundException('auction not found');
    if (auction.status === 'ended' || auction.status === 'cancelled') {
      throw new BadRequestException(
        `cannot invite bidders to ${auction.status} auction`,
      );
    }

    const uniqueIds = Array.from(new Set(bidderProfileIds));

    const bidders = await this.prisma.bidderProfile.findMany({
      where: { id: { in: uniqueIds }, status: 'approved' },
    });
    const biddersById = new Map(bidders.map((b) => [b.id, b]));
    const notFound = uniqueIds.filter((id) => !biddersById.has(id));

    const existing = await this.prisma.auctionInvitation.findMany({
      where: { auctionId, bidderProfileId: { in: uniqueIds } },
      select: { bidderProfileId: true },
    });
    const existingIds = new Set(existing.map((e) => e.bidderProfileId));

    const toCreate = bidders.filter((b) => !existingIds.has(b.id));

    if (toCreate.length === 0) {
      return {
        summary: {
          requested: uniqueIds.length,
          created: 0,
          skippedExisting: existingIds.size,
          notSent: 0,
          sent: 0,
          failed: 0,
          notFound,
        },
        invitations: [],
      };
    }

    // Create all rows first, then attempt SMS dispatch per bidder so a single
    // gateway hiccup doesn't lose all invitations.
    await this.prisma.auctionInvitation.createMany({
      data: toCreate.map((b) => ({
        auctionId,
        bidderProfileId: b.id,
        invitedById,
      })),
      skipDuplicates: true,
    });

    const created = await this.prisma.auctionInvitation.findMany({
      where: {
        auctionId,
        bidderProfileId: { in: toCreate.map((b) => b.id) },
      },
    });
    const createdById = new Map(created.map((c) => [c.bidderProfileId, c]));

    let sent = 0;
    let failed = 0;
    let notSent = 0;

    for (const bidder of toCreate) {
      const invitation = createdById.get(bidder.id);
      if (!invitation) continue;

      const target = this.mobileTarget(bidder);
      if (!target) {
        await this.markStatus(invitation.id, 'skipped', 'no mobile number on file');
        notSent++;
        continue;
      }

      const message = this.buildMessage(auction.code, auction.name);
      try {
        await this.sms.send({
          to: target,
          message,
          dltTemplateId: this.config.sms.dltInvitationTemplateId ?? undefined,
        });
        await this.markStatus(invitation.id, 'sent', null);
        sent++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`invitation SMS failed for ${target}: ${msg}`);
        await this.markStatus(invitation.id, 'failed', msg.slice(0, 1000));
        failed++;
      }
    }

    const invitations = await this.prisma.auctionInvitation.findMany({
      where: { id: { in: created.map((c) => c.id) } },
    });

    return {
      summary: {
        requested: uniqueIds.length,
        created: toCreate.length,
        skippedExisting: existingIds.size,
        notSent,
        sent,
        failed,
        notFound,
      },
      invitations,
    };
  }

  async uninvite(auctionId: string, invitationId: string): Promise<void> {
    const inv = await this.prisma.auctionInvitation.findUnique({
      where: { id: invitationId },
      include: {
        bidderProfile: { select: { userId: true } },
      },
    });
    if (!inv || inv.auctionId !== auctionId) {
      throw new NotFoundException('invitation not found');
    }

    if (inv.joinedAt) {
      // Joining debits EMD into the wallet ledger; uninvite has no refund path,
      // so we block it here rather than orphan the transaction.
      throw new ConflictException(
        'cannot uninvite a bidder who has already joined the auction',
      );
    }

    const bidCount = await this.prisma.bid.count({
      where: {
        bidderId: inv.bidderProfile.userId,
        lot: { auctionId },
      },
    });
    if (bidCount > 0) {
      throw new ConflictException(
        'cannot uninvite a bidder who has already placed bids',
      );
    }

    await this.prisma.auctionInvitation.delete({ where: { id: invitationId } });
  }

  private buildMessage(code: string, name: string): string {
    // Prefer the code (short, fits SMS) but fall back to the friendlier name.
    const ref = code || name;
    return this.config.sms.invitationTemplate.replace(/\{AUCTION\}/g, ref);
  }

  private mobileTarget(b: BidderProfile): string | null {
    if (!b.contactCountryCode || !b.contactNumber) return null;
    return `${b.contactCountryCode}${b.contactNumber}`;
  }

  private async markStatus(
    invitationId: string,
    status: 'sent' | 'failed' | 'skipped',
    error: string | null,
  ): Promise<void> {
    await this.prisma.auctionInvitation.update({
      where: { id: invitationId },
      data: {
        notificationStatus: status,
        notificationSentAt: status === 'sent' ? new Date() : null,
        notificationError: error,
      },
    });
  }
}
