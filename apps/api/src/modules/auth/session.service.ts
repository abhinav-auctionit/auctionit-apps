import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { sessions, type Session, type User } from '../../database/schema';
import { AppConfig } from '../../config/app-config.service';

export type SafeUser = Omit<User, 'passwordHash'>;
export type SessionWithUser = Session & { user: SafeUser };

const TOUCH_THROTTLE_MS = 5 * 60 * 1000;

@Injectable()
export class SessionService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly config: AppConfig,
  ) {}

  async create(
    userId: string,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<Session> {
    const expiresAt = new Date(
      Date.now() + this.config.session.ttlDays * 24 * 60 * 60 * 1000,
    );
    const [row] = await this.db
      .insert(sessions)
      .values({
        userId,
        expiresAt,
        userAgent: meta.userAgent ?? null,
        ipAddress: meta.ipAddress ?? null,
      })
      .returning();
    if (!row) throw new Error('failed to create session');
    return row;
  }

  async findActive(id: string): Promise<SessionWithUser | null> {
    const row = await this.db.query.sessions.findFirst({
      where: and(
        eq(sessions.id, id),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
      with: { user: true },
    });
    if (!row) return null;
    const { passwordHash: _ignored, ...user } = row.user;
    return { ...row, user };
  }

  async touch(id: string, currentLastSeen: Date): Promise<void> {
    if (Date.now() - currentLastSeen.getTime() < TOUCH_THROTTLE_MS) return;
    await this.db
      .update(sessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(sessions.id, id));
  }

  async revoke(id: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.id, id), isNull(sessions.revokedAt)));
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }
}
