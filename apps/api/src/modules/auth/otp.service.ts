import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { OtpChallenge, OtpChannel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfig } from '../../config/app-config.service';
import { hashPassword, verifyPassword } from './password';

const OTP_TTL_MS = 10 * 60 * 1000;
const VERIFICATION_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export interface SendInput {
  channel: OtpChannel;
  target: string;
  purpose: string;
}

export interface VerifyInput extends SendInput {
  code: string;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  static mobileTarget(countryCode: string, number: string): string {
    return `${countryCode}${number}`;
  }

  async send(input: SendInput): Promise<{ challengeId: string; expiresAt: Date }> {
    await this.prisma.otpChallenge.updateMany({
      where: {
        channel: input.channel,
        target: input.target,
        purpose: input.purpose,
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = await hashPassword(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    const challenge = await this.prisma.otpChallenge.create({
      data: {
        channel: input.channel,
        target: input.target,
        purpose: input.purpose,
        codeHash,
        expiresAt,
      },
    });
    this.deliver(input, code);
    return { challengeId: challenge.id, expiresAt };
  }

  async verify(input: VerifyInput): Promise<OtpChallenge> {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        channel: input.channel,
        target: input.target,
        purpose: input.purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge) throw new BadRequestException('no active otp; request a new code');
    if (challenge.attempts >= MAX_ATTEMPTS) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
      throw new HttpException(
        'too many attempts; request a new code',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const ok = await verifyPassword(challenge.codeHash, input.code);
    if (!ok) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('invalid code');
    }
    return this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
  }

  async consumeVerificationToken(
    token: string,
    expected: { channel: OtpChannel; target: string; purpose: string },
  ): Promise<void> {
    const challenge = await this.prisma.otpChallenge.findUnique({ where: { id: token } });
    if (!challenge || challenge.consumedAt == null) {
      throw new BadRequestException('verification token invalid or unverified');
    }
    if (Date.now() - challenge.consumedAt.getTime() > VERIFICATION_TTL_MS) {
      throw new BadRequestException('verification token expired');
    }
    if (
      challenge.channel !== expected.channel ||
      challenge.target !== expected.target ||
      challenge.purpose !== expected.purpose
    ) {
      throw new BadRequestException('verification token mismatch');
    }
    await this.prisma.otpChallenge.delete({ where: { id: challenge.id } });
  }

  private deliver(input: SendInput, code: string): void {
    if (this.config.isProd) {
      this.logger.warn(
        `OTP delivery is stubbed; configure a real provider before production. ` +
          `purpose=${input.purpose} channel=${input.channel} target=${input.target}`,
      );
      return;
    }
    this.logger.log(
      `[OTP] purpose=${input.purpose} channel=${input.channel} target=${input.target} code=${code}`,
    );
  }
}
