import { Injectable } from '@nestjs/common';
import type { Session, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfig } from '../../config/app-config.service';

export type SafeUser = Omit<User, 'passwordHash' | 'passwordHashAlgo'>;
export type SessionWithUser = Session & { user: SafeUser };

const TOUCH_THROTTLE_MS = 5 * 60 * 1000;

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  async create(
    userId: string,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<Session> {
    const expiresAt = new Date(
      Date.now() + this.config.session.ttlDays * 24 * 60 * 60 * 1000,
    );
    return this.prisma.session.create({
      data: {
        userId,
        expiresAt,
        userAgent: meta.userAgent ?? null,
        ipAddress: meta.ipAddress ?? null,
      },
    });
  }

  async findActive(id: string): Promise<SessionWithUser | null> {
    const row = await this.prisma.session.findFirst({
      where: {
        id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
    if (!row) return null;
    const {
      passwordHash: _ignoredHash,
      passwordHashAlgo: _ignoredAlgo,
      ...user
    } = row.user;
    return { ...row, user };
  }

  async touch(id: string, currentLastSeen: Date): Promise<void> {
    if (Date.now() - currentLastSeen.getTime() < TOUCH_THROTTLE_MS) return;
    await this.prisma.session.update({
      where: { id },
      data: { lastSeenAt: new Date() },
    });
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
