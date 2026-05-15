import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { AuctionLifecycleService } from './auction-lifecycle.service';

@Injectable()
export class AuctionSchedulerService {
  private readonly logger = new Logger(AuctionSchedulerService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: AuctionLifecycleService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      await this.openLiveAuctions(now);
      await this.endCompletedAuctions(now);
    } catch (err) {
      this.logger.error(`tick failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  // scheduled → live: any auction whose first lot has started.
  private async openLiveAuctions(now: Date) {
    const result = await this.prisma.auction.updateMany({
      where: {
        status: 'scheduled',
        lots: { some: { startTime: { lte: now } } },
      },
      data: { status: 'live' },
    });
    if (result.count > 0) {
      this.logger.log(`opened ${result.count} auction(s) to live`);
    }
  }

  // live (or still-scheduled) → ended: every lot's endTime has passed.
  // Delegates to lifecycle.endAuction so winner assignment, EMD release, and
  // consolidated settlement run with the same code path as a manual end.
  private async endCompletedAuctions(now: Date) {
    const candidates = await this.prisma.auction.findMany({
      where: { status: { in: ['scheduled', 'live'] } },
      select: {
        id: true,
        lots: { select: { endTime: true } },
      },
    });
    const toEnd = candidates
      .filter((a) => a.lots.length > 0 && a.lots.every((l) => l.endTime <= now))
      .map((a) => a.id);
    for (const id of toEnd) {
      try {
        await this.lifecycle.endAuction(id, null);
        this.logger.log(`auto-ended auction ${id}`);
      } catch (err) {
        this.logger.error(
          `failed to auto-end auction ${id}: ${(err as Error).message}`,
        );
      }
    }
  }
}
