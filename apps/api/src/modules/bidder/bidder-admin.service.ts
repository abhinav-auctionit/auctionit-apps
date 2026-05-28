import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { BidderProfile, BidderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const PROFILE_DETAIL_INCLUDE = {
  user: { select: { id: true, email: true, name: true, mobileCountryCode: true, mobileNumber: true, role: true, createdAt: true } },
  panCardFile: true,
  proofOfAddressFile: true,
  cancelledChequeFile: true,
  otherFile: true,
} satisfies Prisma.BidderProfileInclude;

@Injectable()
export class BidderAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: { status?: BidderStatus; page: number; pageSize: number }) {
    const where = params.status ? { status: params.status } : undefined;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.bidderProfile.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
        orderBy: { submittedAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.bidderProfile.count({ where }),
    ]);
    return { rows, total, page: params.page, pageSize: params.pageSize };
  }

  async findOne(id: string) {
    const row = await this.prisma.bidderProfile.findUnique({
      where: { id },
      include: PROFILE_DETAIL_INCLUDE,
    });
    if (!row) throw new NotFoundException('bidder profile not found');
    return row;
  }

  async markFeePaid(id: string, note?: string): Promise<BidderProfile> {
    const profile = await this.findOne(id);
    if (profile.registrationFeePaid) {
      throw new ConflictException('fee is already marked paid');
    }
    return this.prisma.bidderProfile.update({
      where: { id },
      data: {
        registrationFeePaid: true,
        registrationFeePaidAt: new Date(),
        registrationFeeNote: note ?? null,
      },
    });
  }

  async approve(id: string): Promise<BidderProfile> {
    const profile = await this.findOne(id);
    if (profile.status === 'approved') {
      throw new ConflictException('already approved');
    }
    if (profile.status !== 'pending_approval') {
      throw new BadRequestException(
        `cannot approve from status=${profile.status}; submit first`,
      );
    }
    if (!profile.registrationFeePaid) {
      throw new BadRequestException('mark registration fee paid before approving');
    }
    return this.prisma.bidderProfile.update({
      where: { id },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        rejectedAt: null,
        rejectionNote: null,
      },
    });
  }

  async reject(id: string, note: string): Promise<BidderProfile> {
    const profile = await this.findOne(id);
    if (profile.status === 'approved') {
      throw new ConflictException('cannot reject an already-approved profile');
    }
    return this.prisma.bidderProfile.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectedAt: new Date(),
        approvedAt: null,
        rejectionNote: note,
      },
    });
  }
}
