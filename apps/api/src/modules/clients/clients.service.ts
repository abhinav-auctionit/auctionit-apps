import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type Client,
  type ClientContactPoint,
  type ClientLocation,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ClientCreateDto } from './dto/client-create.dto';
import type { ClientLocationCreateDto } from './dto/client-location-create.dto';
import type { ClientLocationUpdateDto } from './dto/client-location-update.dto';
import type { ClientContactCreateDto } from './dto/client-contact-create.dto';
import type { ClientContactUpdateDto } from './dto/client-contact-update.dto';

const LOCATION_INCLUDE = {
  contacts: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.ClientLocationInclude;

export type ClientLocationWithContacts = ClientLocation & {
  contacts: ClientContactPoint[];
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
