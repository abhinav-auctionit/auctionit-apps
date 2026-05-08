import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Client } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ClientCreateDto } from './dto/client-create.dto';

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
}
