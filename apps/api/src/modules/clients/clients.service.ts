import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuctionStatus,
  Prisma,
  type Client,
  type ClientContactPoint,
  type ClientEngagement,
  type ClientLocation,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ClientCreateDto } from './dto/client-create.dto';
import type { ClientLocationCreateDto } from './dto/client-location-create.dto';
import type { ClientLocationUpdateDto } from './dto/client-location-update.dto';
import type { ClientContactCreateDto } from './dto/client-contact-create.dto';
import type { ClientContactUpdateDto } from './dto/client-contact-update.dto';
import type { ClientEngagementCreateDto } from './dto/client-engagement-create.dto';
import type { ClientEngagementUpdateDto } from './dto/client-engagement-update.dto';

const LOCATION_INCLUDE = {
  contacts: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.ClientLocationInclude;

const ENGAGEMENT_INCLUDE = {
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ClientEngagementInclude;

export type ClientLocationWithContacts = ClientLocation & {
  contacts: ClientContactPoint[];
};

export type ClientEngagementWithUser = ClientEngagement & {
  createdBy: { id: string; name: string; email: string } | null;
};

type AuctionLocationSummary = {
  id: string;
  name: string;
  city: string;
  state: string;
};

export type AuctionHistoryRow = {
  id: string;
  code: string;
  name: string;
  status: AuctionStatus;
  startAt: string | null;
  location: AuctionLocationSummary | null;
  totalQty: number;
  qtyUom: string | null;
  totalAmountCents: number;
};

export type AuctionHistoryStats = {
  totalAuctions: number;
  totalValueCents: number;
  avgValueCents: number;
  totalQty: number;
  qtyUom: string | null;
};

export type AuctionHistoryUpcoming = AuctionHistoryRow & {
  firstItemName: string | null;
};

export type AuctionHistoryResponse = {
  stats: AuctionHistoryStats;
  upcoming: AuctionHistoryUpcoming | null;
  auctions: AuctionHistoryRow[];
  locations: AuctionLocationSummary[];
};

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<Client[]> {
    return this.prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async findOne(id: string): Promise<Client> {
    const row = await this.prisma.client.findUnique({
      where: { id },
      include: { tncFile: true },
    });
    if (!row) throw new NotFoundException('client not found');
    return row;
  }

  async create(dto: ClientCreateDto, createdById: string): Promise<Client> {
    if (dto.tncFileId) {
      const file = await this.prisma.storedFile.findUnique({ where: { id: dto.tncFileId } });
      if (!file) throw new BadRequestException('tncFileId: file not found');
      if (file.uploadedById !== createdById) {
        throw new ForbiddenException('tncFileId: not your upload');
      }
    }

    try {
      return await this.prisma.client.create({
        data: {
          companyName: dto.companyName,
          phone: dto.phone ?? null,
          websiteUrl: dto.websiteUrl ?? null,
          registeredAddress: dto.registeredAddress,
          country: dto.country,
          pan: dto.pan,
          tan: dto.tan,
          tin: dto.tin,
          isActive: dto.isActive,
          prefixAuctionCode: dto.prefixAuctionCode ?? null,
          suffixAuctionCode: dto.suffixAuctionCode ?? null,
          autoExtend: dto.autoExtend,
          extendIfLastBidSec: dto.extendIfLastBidSec ?? null,
          extendDurationSec: dto.extendDurationSec ?? null,
          extensionMaxTimes: dto.extensionMaxTimes ?? null,
          staggeringOfLots: dto.staggeringOfLots ?? null,
          staggeringOfLotsDurationSec: dto.staggeringOfLotsDurationSec ?? null,
          staggeringOfAuction: dto.staggeringOfAuction ?? null,
          staggeringOfAuctionDurationSec: dto.staggeringOfAuctionDurationSec ?? null,
          otherChargeType: dto.otherChargeType ?? null,
          otherChargeAmount: dto.otherChargeAmount ?? null,
          revenueRate: dto.revenueRate,
          plantTechPersonDetails: dto.plantTechPersonDetails ?? null,
          displayMaterialLocation: dto.displayMaterialLocation,
          displayPlantLocation: dto.displayPlantLocation,
          tncFileId: dto.tncFileId ?? null,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('a client with this PAN already exists');
      }
      throw err;
    }
  }

  // -- Locations -------------------------------------------------------------

  async listLocations(clientId: string): Promise<ClientLocationWithContacts[]> {
    await this.assertClientExists(clientId);
    return this.prisma.clientLocation.findMany({
      where: { clientId },
      include: LOCATION_INCLUDE,
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async createLocation(
    clientId: string,
    dto: ClientLocationCreateDto,
  ): Promise<ClientLocationWithContacts> {
    await this.assertClientExists(clientId);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.clientLocation.updateMany({
          where: { clientId, isPrimary: true },
          data: { isPrimary: false },
        });
      }
      return tx.clientLocation.create({
        data: {
          clientId,
          name: dto.name,
          addressLine: dto.addressLine ?? null,
          city: dto.city,
          state: dto.state,
          pincode: dto.pincode,
          country: dto.country,
          isPrimary: dto.isPrimary ?? false,
        },
        include: LOCATION_INCLUDE,
      });
    });
  }

  async updateLocation(
    clientId: string,
    locationId: string,
    dto: ClientLocationUpdateDto,
  ): Promise<ClientLocationWithContacts> {
    await this.assertLocationBelongs(clientId, locationId);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary === true) {
        await tx.clientLocation.updateMany({
          where: { clientId, isPrimary: true, NOT: { id: locationId } },
          data: { isPrimary: false },
        });
      }
      return tx.clientLocation.update({
        where: { id: locationId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.addressLine !== undefined ? { addressLine: dto.addressLine } : {}),
          ...(dto.city !== undefined ? { city: dto.city } : {}),
          ...(dto.state !== undefined ? { state: dto.state } : {}),
          ...(dto.pincode !== undefined ? { pincode: dto.pincode } : {}),
          ...(dto.country !== undefined ? { country: dto.country } : {}),
          ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
        },
        include: LOCATION_INCLUDE,
      });
    });
  }

  async deleteLocation(clientId: string, locationId: string): Promise<void> {
    await this.assertLocationBelongs(clientId, locationId);
    await this.prisma.clientLocation.delete({ where: { id: locationId } });
  }

  // -- Contact points --------------------------------------------------------

  async createContact(
    clientId: string,
    locationId: string,
    dto: ClientContactCreateDto,
  ): Promise<ClientContactPoint> {
    await this.assertLocationBelongs(clientId, locationId);
    return this.prisma.clientContactPoint.create({
      data: {
        locationId,
        name: dto.name,
        role: dto.role ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
      },
    });
  }

  async updateContact(
    clientId: string,
    locationId: string,
    contactId: string,
    dto: ClientContactUpdateDto,
  ): Promise<ClientContactPoint> {
    await this.assertContactBelongs(clientId, locationId, contactId);
    return this.prisma.clientContactPoint.update({
      where: { id: contactId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      },
    });
  }

  async deleteContact(
    clientId: string,
    locationId: string,
    contactId: string,
  ): Promise<void> {
    await this.assertContactBelongs(clientId, locationId, contactId);
    await this.prisma.clientContactPoint.delete({ where: { id: contactId } });
  }

  // -- Auction history -------------------------------------------------------

  async getAuctionHistory(clientId: string): Promise<AuctionHistoryResponse> {
    await this.assertClientExists(clientId);

    const auctions = await this.prisma.auction.findMany({
      where: { clientId, status: { not: 'draft' } },
      include: {
        location: { select: { id: true, name: true, city: true, state: true } },
        lots: {
          select: {
            qty: true,
            uom: true,
            startTime: true,
            itemName: true,
            bids: {
              orderBy: { amountCents: 'desc' },
              take: 1,
              select: { amountCents: true },
            },
          },
        },
      },
    });

    const firstItemNameByAuction = new Map<string, string | null>();
    const rows: AuctionHistoryRow[] = auctions.map((a) => {
      const sortedLots = a.lots
        .slice()
        .sort((x, y) => x.startTime.getTime() - y.startTime.getTime());
      const startAt = sortedLots[0]?.startTime ?? null;

      let totalQty = 0;
      let totalAmountCents = 0;
      const uomSet = new Set<string>();
      for (const l of a.lots) {
        totalQty += Number(l.qty);
        uomSet.add(l.uom);
        const winning = l.bids[0]?.amountCents ?? 0;
        totalAmountCents += winning;
      }
      const qtyUom = uomSet.size === 1 ? Array.from(uomSet)[0]! : null;
      firstItemNameByAuction.set(a.id, sortedLots[0]?.itemName ?? null);

      return {
        id: a.id,
        code: a.code,
        name: a.name,
        status: a.status,
        startAt: startAt ? startAt.toISOString() : null,
        location: a.location,
        totalQty,
        qtyUom,
        totalAmountCents,
      };
    });

    rows.sort((a, b) => {
      const aTime = a.startAt ? Date.parse(a.startAt) : 0;
      const bTime = b.startAt ? Date.parse(b.startAt) : 0;
      return bTime - aTime;
    });

    // Stats across what's visible in the table.
    const totalAuctions = rows.length;
    const totalValueCents = rows.reduce((s, r) => s + r.totalAmountCents, 0);
    const totalQty = rows.reduce((s, r) => s + r.totalQty, 0);
    const statsUomSet = new Set(rows.map((r) => r.qtyUom).filter((u): u is string => !!u));
    const qtyUom = statsUomSet.size === 1 ? Array.from(statsUomSet)[0]! : null;
    const avgValueCents = totalAuctions === 0 ? 0 : Math.round(totalValueCents / totalAuctions);

    // Upcoming = next scheduled auction by earliest lot start time in the future.
    const now = Date.now();
    const upcomingCandidates = rows.filter(
      (r) =>
        r.status === 'scheduled' && r.startAt !== null && Date.parse(r.startAt) > now,
    );
    upcomingCandidates.sort((a, b) => Date.parse(a.startAt!) - Date.parse(b.startAt!));
    const upcomingRow = upcomingCandidates[0] ?? null;

    const locations = await this.prisma.clientLocation.findMany({
      where: { clientId },
      select: { id: true, name: true, city: true, state: true },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });

    return {
      stats: { totalAuctions, totalValueCents, avgValueCents, totalQty, qtyUom },
      upcoming: upcomingRow
        ? {
            ...upcomingRow,
            firstItemName: firstItemNameByAuction.get(upcomingRow.id) ?? null,
          }
        : null,
      auctions: rows,
      locations,
    };
  }

  // -- Engagements -----------------------------------------------------------

  async listEngagements(clientId: string): Promise<ClientEngagementWithUser[]> {
    await this.assertClientExists(clientId);
    return this.prisma.clientEngagement.findMany({
      where: { clientId },
      include: ENGAGEMENT_INCLUDE,
      orderBy: { happenedAt: 'desc' },
    });
  }

  async createEngagement(
    clientId: string,
    dto: ClientEngagementCreateDto,
    createdById: string,
  ): Promise<ClientEngagementWithUser> {
    await this.assertClientExists(clientId);
    return this.prisma.clientEngagement.create({
      data: {
        clientId,
        happenedAt: new Date(dto.happenedAt),
        personName: dto.personName,
        personRole: dto.personRole ?? null,
        purpose: dto.purpose,
        medium: dto.medium,
        comments: dto.comments,
        createdById,
      },
      include: ENGAGEMENT_INCLUDE,
    });
  }

  async updateEngagement(
    clientId: string,
    engagementId: string,
    dto: ClientEngagementUpdateDto,
  ): Promise<ClientEngagementWithUser> {
    await this.assertEngagementBelongs(clientId, engagementId);
    return this.prisma.clientEngagement.update({
      where: { id: engagementId },
      data: {
        ...(dto.happenedAt !== undefined ? { happenedAt: new Date(dto.happenedAt) } : {}),
        ...(dto.personName !== undefined ? { personName: dto.personName } : {}),
        ...(dto.personRole !== undefined ? { personRole: dto.personRole } : {}),
        ...(dto.purpose !== undefined ? { purpose: dto.purpose } : {}),
        ...(dto.medium !== undefined ? { medium: dto.medium } : {}),
        ...(dto.comments !== undefined ? { comments: dto.comments } : {}),
      },
      include: ENGAGEMENT_INCLUDE,
    });
  }

  async deleteEngagement(clientId: string, engagementId: string): Promise<void> {
    await this.assertEngagementBelongs(clientId, engagementId);
    await this.prisma.clientEngagement.delete({ where: { id: engagementId } });
  }

  // -- Helpers ---------------------------------------------------------------

  private async assertClientExists(clientId: string): Promise<void> {
    const exists = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('client not found');
  }

  private async assertLocationBelongs(clientId: string, locationId: string): Promise<void> {
    const loc = await this.prisma.clientLocation.findUnique({
      where: { id: locationId },
      select: { clientId: true },
    });
    if (!loc || loc.clientId !== clientId) {
      throw new NotFoundException('location not found for this client');
    }
  }

  private async assertEngagementBelongs(
    clientId: string,
    engagementId: string,
  ): Promise<void> {
    const engagement = await this.prisma.clientEngagement.findUnique({
      where: { id: engagementId },
      select: { clientId: true },
    });
    if (!engagement || engagement.clientId !== clientId) {
      throw new NotFoundException('engagement not found for this client');
    }
  }

  private async assertContactBelongs(
    clientId: string,
    locationId: string,
    contactId: string,
  ): Promise<void> {
    const contact = await this.prisma.clientContactPoint.findUnique({
      where: { id: contactId },
      select: { location: { select: { id: true, clientId: true } } },
    });
    if (
      !contact ||
      contact.location.id !== locationId ||
      contact.location.clientId !== clientId
    ) {
      throw new NotFoundException('contact not found for this location');
    }
  }
}
