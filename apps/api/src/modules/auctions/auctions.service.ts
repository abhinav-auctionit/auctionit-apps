import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateAuctionDto } from './dto/create-auction.dto';

@Injectable()
export class AuctionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.auction.findMany({
      orderBy: { startsAt: 'desc' },
      take: 100,
    });
  }

  async listUpcomingPublic(limit = 24) {
    const rows = await this.prisma.auction.findMany({
      where: { status: { in: ['scheduled', 'live'] } },
      orderBy: { startsAt: 'asc' },
      take: limit,
      select: {
        id: true,
        title: true,
        description: true,
        startingPriceCents: true,
        currentPriceCents: true,
        status: true,
        startsAt: true,
        endsAt: true,
      },
    });
    return rows;
  }

  async findOne(id: string) {
    const row = await this.prisma.auction.findUnique({
      where: { id },
      include: { seller: true },
    });
    if (!row) throw new NotFoundException(`auction ${id} not found`);
    return row;
  }

  async create(sellerId: string, dto: CreateAuctionDto) {
    return this.prisma.auction.create({
      data: {
        ...dto,
        sellerId,
        currentPriceCents: dto.startingPriceCents,
      },
    });
  }
}
