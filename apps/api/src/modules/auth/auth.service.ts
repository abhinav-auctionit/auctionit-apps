import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { hashPassword, verifyPassword } from './password';
import { OtpService } from './otp.service';
import type { SafeUser } from './session.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { CreateUserDto } from './dto/create-user.dto';
import type { BidderRegisterDto } from './dto/bidder-register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
  ) {}

  async register(dto: RegisterDto): Promise<SafeUser> {
    return this.createUser(dto);
  }

  async createUser(dto: CreateUserDto | RegisterDto): Promise<SafeUser> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existing) throw new ConflictException('email already registered');

    const passwordHash = await hashPassword(dto.password);
    const row = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: dto.role,
      },
    });
    const { passwordHash: _ignored, ...user } = row;
    return user;
  }

  async login(dto: LoginDto): Promise<SafeUser> {
    const row = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!row) throw new UnauthorizedException('invalid credentials');

    const ok = await verifyPassword(row.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException('invalid credentials');

    const { passwordHash: _ignored, ...user } = row;
    return user;
  }

  async findUserByEmailForOtp(email: string): Promise<SafeUser | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    if (!row) return null;
    const { passwordHash: _ignored, ...user } = row;
    return user;
  }

  async findUserByMobileForOtp(
    countryCode: string,
    number: string,
  ): Promise<SafeUser | null> {
    const row = await this.prisma.user.findFirst({
      where: { mobileCountryCode: countryCode, mobileNumber: number },
    });
    if (!row) return null;
    const { passwordHash: _ignored, ...user } = row;
    return user;
  }

  async registerBidder(dto: BidderRegisterDto): Promise<SafeUser> {
    await this.otp.consumeVerificationToken(dto.verificationToken, {
      channel: 'mobile',
      target: OtpService.mobileTarget(dto.mobileCountryCode, dto.mobileNumber),
      purpose: 'bidder_register',
    });

    const [emailTaken, mobileTaken] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } }),
      this.prisma.user.findFirst({
        where: { mobileCountryCode: dto.mobileCountryCode, mobileNumber: dto.mobileNumber },
        select: { id: true },
      }),
    ]);
    if (emailTaken) throw new ConflictException('email already registered');
    if (mobileTaken) throw new ConflictException('mobile already registered');

    const passwordHash = await hashPassword(dto.password);
    const row = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.fullName,
        passwordHash,
        role: 'bidder',
        mobileCountryCode: dto.mobileCountryCode,
        mobileNumber: dto.mobileNumber,
        bidderProfile: {
          create: {
            interestedIn: dto.interestedIn,
            fullName: dto.fullName,
            contactCountryCode: dto.mobileCountryCode,
            contactNumber: dto.mobileNumber,
            whatsappCountryCode: dto.whatsappCountryCode,
            whatsappNumber: dto.whatsappNumber,
            registeredEmail: dto.email,
          },
        },
      },
    });
    const { passwordHash: _ignored, ...user } = row;
    return user;
  }
}
