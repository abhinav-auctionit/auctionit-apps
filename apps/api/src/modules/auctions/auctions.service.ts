import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type AuctionStatus,
  Prisma,
  type Auction,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateAuctionDto } from './dto/create-auction.dto';
import type { UpdateAuctionDto } from './dto/update-auction.dto';
import type { CreateLotDto } from './dto/create-lot.dto';
import type { UpdateLotDto } from './dto/update-lot.dto';

const LOCATION_SELECT = {
  id: true,
  name: true,
  city: true,
  state: true,
} satisfies Prisma.ClientLocationSelect;

const LIST_INCLUDE = {
  client: { select: { id: true, companyName: true, country: true } },
  location: { select: LOCATION_SELECT },
  _count: { select: { lots: true } },
} satisfies Prisma.AuctionInclude;

const LOT_ITEM_SELECT = {
  id: true,
  name: true,
  uom: true,
  subcategory: {
    select: {
      id: true,
      name: true,
      category: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.ItemSelect;

const LOT_INCLUDE = {
  item: { select: LOT_ITEM_SELECT },
} satisfies Prisma.LotInclude;

const DETAIL_INCLUDE = {
  client: { select: { id: true, companyName: true, country: true } },
  location: { select: LOCATION_SELECT },
  createdBy: { select: { id: true, name: true, email: true } },
  lots: {
    orderBy: { lotNo: 'asc' as const },
    include: LOT_INCLUDE,
  },
} satisfies Prisma.AuctionInclude;

@Injectable()
export class AuctionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: { clientId?: string; code?: string; status?: AuctionStatus }) {
    return this.prisma.auction.findMany({
      where: {
        ...(filter.clientId ? { clientId: filter.clientId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.code
          ? { code: { contains: filter.code, mode: 'insensitive' } }
          : {}),
      },
      include: LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.auction.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!row) throw new NotFoundException('auction not found');
    return row;
  }

  async create(dto: CreateAuctionDto, createdById: string): Promise<Auction> {
    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
      select: { id: true, isActive: true },
    });
    if (!client) throw new BadRequestException('clientId: client not found');
    if (!client.isActive) {
      throw new BadRequestException('client is inactive — reactivate before creating auctions');
    }
    if (dto.locationId) {
      const loc = await this.prisma.clientLocation.findUnique({
        where: { id: dto.locationId },
        select: { clientId: true },
      });
      if (!loc || loc.clientId !== dto.clientId) {
        throw new BadRequestException('locationId: location does not belong to this client');
      }
    }
    try {
      return await this.prisma.auction.create({
        data: {
          clientId: dto.clientId,
          locationId: dto.locationId ?? null,
          code: dto.code,
          name: dto.name,
          auctionType: dto.auctionType,
          consolidatedEmdAmount: dto.consolidatedEmdAmount ?? null,
          description: dto.description ?? null,
          createdById,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`auction code "${dto.code}" already exists`);
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateAuctionDto): Promise<Auction> {
    const existing = await this.findOne(id);
    if (dto.locationId) {
      const loc = await this.prisma.clientLocation.findUnique({
        where: { id: dto.locationId },
        select: { clientId: true },
      });
      if (!loc || loc.clientId !== existing.clientId) {
        throw new BadRequestException('locationId: location does not belong to this client');
      }
    }
    // Block consolidated EMD edits once anyone is attached — held money would
    // no longer match the configured amount. Admin must detach first.
    if (dto.consolidatedEmdAmount !== undefined) {
      const attached = await this.prisma.auctionParticipation.count({
        where: { auctionId: id },
      });
      if (attached > 0) {
        throw new ConflictException(
          'cannot change consolidated EMD while bidders are attached; detach them first',
        );
      }
    }
    try {
      return await this.prisma.auction.update({
        where: { id },
        data: {
          ...(dto.locationId !== undefined ? { locationId: dto.locationId } : {}),
          ...(dto.code !== undefined ? { code: dto.code } : {}),
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.auctionType !== undefined ? { auctionType: dto.auctionType } : {}),
          ...(dto.consolidatedEmdAmount !== undefined
            ? { consolidatedEmdAmount: dto.consolidatedEmdAmount }
            : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`auction code already exists`);
      }
      throw err;
    }
  }

  // -- Lots ------------------------------------------------------------------

  async addLot(auctionId: string, dto: CreateLotDto) {
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      select: { status: true },
    });
    if (!auction) throw new NotFoundException('auction not found');
    if (auction.status === 'ended' || auction.status === 'cancelled') {
      throw new BadRequestException(`cannot add lots to ${auction.status} auction`);
    }
    const last = await this.prisma.lot.findFirst({
      where: { auctionId },
      orderBy: { lotNo: 'desc' },
      select: { lotNo: true },
    });
    const lotNo = (last?.lotNo ?? 0) + 1;

    if (dto.itemId) {
      const item = await this.prisma.item.findUnique({
        where: { id: dto.itemId },
        select: { id: true },
      });
      if (!item) throw new BadRequestException('itemId: item not found');
    }

    return this.prisma.lot.create({
      data: {
        auctionId,
        lotNo,
        itemId: dto.itemId ?? null,
        itemName: dto.itemName,
        description: dto.description ?? null,
        qty: dto.qty,
        uom: dto.uom,
        auctionDate: dto.auctionDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
        startingPriceCents: dto.startingPriceCents,
        bidIncrementCents: dto.bidIncrementCents,
        emdAmount: dto.emdAmount,
      },
      include: LOT_INCLUDE,
    });
  }

  async updateLot(auctionId: string, lotId: string, dto: UpdateLotDto) {
    const lot = await this.prisma.lot.findUnique({ where: { id: lotId } });
    if (!lot || lot.auctionId !== auctionId) {
      throw new NotFoundException('lot not found in this auction');
    }
    if (dto.itemId) {
      const item = await this.prisma.item.findUnique({
        where: { id: dto.itemId },
        select: { id: true },
      });
      if (!item) throw new BadRequestException('itemId: item not found');
    }
    // Block EMD edits while any participation row exists for this lot — held
    // money would no longer match the configured amount.
    if (dto.emdAmount !== undefined) {
      const attached = await this.prisma.lotParticipation.count({
        where: { lotId },
      });
      if (attached > 0) {
        throw new ConflictException(
          'cannot change lot EMD while bidders are attached; detach them first',
        );
      }
    }
    return this.prisma.lot.update({
      where: { id: lotId },
      data: {
        ...(dto.itemId !== undefined ? { itemId: dto.itemId } : {}),
        ...(dto.itemName !== undefined ? { itemName: dto.itemName } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.qty !== undefined ? { qty: dto.qty } : {}),
        ...(dto.uom !== undefined ? { uom: dto.uom } : {}),
        ...(dto.auctionDate !== undefined ? { auctionDate: dto.auctionDate } : {}),
        ...(dto.startTime !== undefined ? { startTime: dto.startTime } : {}),
        ...(dto.endTime !== undefined ? { endTime: dto.endTime } : {}),
        ...(dto.startingPriceCents !== undefined
          ? { startingPriceCents: dto.startingPriceCents }
          : {}),
        ...(dto.bidIncrementCents !== undefined
          ? { bidIncrementCents: dto.bidIncrementCents }
          : {}),
        ...(dto.emdAmount !== undefined ? { emdAmount: dto.emdAmount } : {}),
      },
      include: LOT_INCLUDE,
    });
  }

  async deleteLot(auctionId: string, lotId: string): Promise<void> {
    const lot = await this.prisma.lot.findUnique({
      where: { id: lotId },
      include: { _count: { select: { bids: true } } },
    });
    if (!lot || lot.auctionId !== auctionId) {
      throw new NotFoundException('lot not found in this auction');
    }
    if (lot._count.bids > 0) {
      throw new ConflictException(
        'cannot delete a lot that already has bids; cancel the auction instead',
      );
    }
    await this.prisma.lot.delete({ where: { id: lotId } });
  }

  // -- Public listing --------------------------------------------------------

  async listUpcomingPublic(limit = 24) {
    return this.prisma.auction.findMany({
      where: {
        status: { in: ['scheduled', 'live'] },
        lots: { some: {} },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        code: true,
        name: true,
        auctionType: true,
        status: true,
        consolidatedEmdAmount: true,
        description: true,
        client: { select: { companyName: true } },
        lots: {
          orderBy: { startTime: 'asc' },
          select: {
            id: true,
            lotNo: true,
            itemName: true,
            qty: true,
            uom: true,
            startTime: true,
            endTime: true,
            startingPriceCents: true,
            bidIncrementCents: true,
          },
        },
      },
    });
  }
}
