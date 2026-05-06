import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { BidderProfile, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { SafeUser } from '../auth/session.service';
import type { BidderProfilePatchDto } from './dto/bidder-profile-patch.dto';
import { isStateValid, STATES_BY_COUNTRY } from './constants';

const FILE_FK_FIELDS = [
  'panCardFileId',
  'proofOfAddressFileId',
  'cancelledChequeFileId',
  'otherFileId',
] as const;

const REQUIRED_FOR_SUBMIT: Array<keyof BidderProfile> = [
  'interestedIn',
  'fullName',
  'contactCountryCode',
  'contactNumber',
  'whatsappCountryCode',
  'whatsappNumber',
  'companyName',
  'companyType',
  'businessActivity',
  'address',
  'country',
  'state',
  'city',
  'pinCode',
  'designation',
  'registeredEmail',
  'gst',
  'pan',
  'panCardFileId',
  'proofOfAddressFileId',
  'cancelledChequeFileId',
  'bankAccountNumber',
  'bankName',
  'ifscCode',
  'termsAcceptedAt',
  'signatoryName',
  'signatoryDesignation',
  'signatoryPlace',
  'signatoryDate',
  'subscriptionType',
];

@Injectable()
export class BidderService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyProfile(user: SafeUser): Promise<BidderProfile> {
    const profile = await this.prisma.bidderProfile.findUnique({
      where: { userId: user.id },
    });
    if (!profile) throw new NotFoundException('bidder profile not found');
    return profile;
  }

  async patchMyProfile(
    user: SafeUser,
    dto: BidderProfilePatchDto,
  ): Promise<BidderProfile> {
    const profile = await this.getMyProfile(user);
    this.assertEditable(profile);

    if ('contactCountryCode' in dto || 'contactNumber' in dto) {
      throw new BadRequestException(
        'contact mobile is set at registration and cannot be changed here',
      );
    }

    const data: Prisma.BidderProfileUpdateInput = {};
    const next: Pick<BidderProfile, 'country' | 'state'> = {
      country: dto.country ?? profile.country,
      state: dto.state ?? profile.state,
    };
    if (next.country && next.state && !isStateValid(next.country as never, next.state)) {
      throw new BadRequestException(
        `state "${next.state}" is not valid for country "${next.country}"`,
      );
    }
    if (dto.country && dto.country !== profile.country && dto.state === undefined) {
      data.state = null;
    }

    for (const field of FILE_FK_FIELDS) {
      const value = dto[field];
      if (value === undefined) continue;
      if (value === null) {
        (data as Record<string, unknown>)[field] = null;
        continue;
      }
      const file = await this.prisma.storedFile.findUnique({ where: { id: value } });
      if (!file) throw new BadRequestException(`${field}: file not found`);
      if (file.uploadedById !== user.id) {
        throw new ForbiddenException(`${field}: not your file`);
      }
      (data as Record<string, unknown>)[field] = value;
    }

    const directFields = [
      'interestedIn',
      'fullName',
      'whatsappCountryCode',
      'whatsappNumber',
      'companyName',
      'companyType',
      'businessActivity',
      'address',
      'country',
      'state',
      'city',
      'pinCode',
      'designation',
      'secondaryNumber',
      'registeredEmail',
      'gst',
      'pan',
      'bankAccountNumber',
      'bankName',
      'ifscCode',
      'signatoryName',
      'signatoryDesignation',
      'signatoryPlace',
      'signatoryDate',
      'subscriptionType',
    ] as const;
    for (const f of directFields) {
      if (dto[f] !== undefined) (data as Record<string, unknown>)[f] = dto[f];
    }

    if (dto.termsAccepted === true) {
      data.termsAcceptedAt = new Date();
    } else if (dto.termsAccepted === false) {
      data.termsAcceptedAt = null;
    }

    return this.prisma.bidderProfile.update({
      where: { userId: user.id },
      data,
    });
  }

  async submit(user: SafeUser): Promise<BidderProfile> {
    const profile = await this.getMyProfile(user);
    this.assertEditable(profile);

    const missing = REQUIRED_FOR_SUBMIT.filter((k) => {
      const v = profile[k];
      if (v === null || v === undefined) return true;
      if (typeof v === 'string' && v.trim() === '') return true;
      return false;
    });
    if (missing.length > 0) {
      throw new BadRequestException({
        message: 'profile is incomplete',
        missing,
      });
    }
    if (profile.country && profile.state && !isStateValid(profile.country as never, profile.state)) {
      throw new BadRequestException('state is not valid for country');
    }

    return this.prisma.bidderProfile.update({
      where: { userId: user.id },
      data: {
        status: 'pending_approval',
        submittedAt: new Date(),
        rejectionNote: null,
      },
    });
  }

  private assertEditable(profile: BidderProfile): void {
    if (profile.status === 'pending_approval') {
      throw new ConflictException('profile is under review and cannot be edited');
    }
    if (profile.status === 'approved') {
      throw new ConflictException('profile is already approved');
    }
  }

  static get countriesAndStates() {
    return STATES_BY_COUNTRY;
  }

  async assertCanBid(userId: string): Promise<void> {
    const profile = await this.prisma.bidderProfile.findUnique({
      where: { userId },
      select: { status: true, registrationFeePaid: true },
    });
    if (!profile) {
      throw new ForbiddenException('bidder profile required');
    }
    if (profile.status !== 'approved') {
      throw new ForbiddenException(`bidder not approved (status=${profile.status})`);
    }
    if (!profile.registrationFeePaid) {
      throw new ForbiddenException('registration fee not recorded');
    }
  }
}
