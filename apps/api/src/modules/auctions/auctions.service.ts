import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { auctions } from '../../database/schema';
import type { CreateAuctionDto } from './dto/create-auction.dto';

@Injectable()
export class AuctionsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list() {
    return this.db.query.auctions.findMany({
      orderBy: [desc(auctions.startsAt)],
      limit: 100,
    });
  }

  async findOne(id: string) {
    const row = await this.db.query.auctions.findFirst({
      where: eq(auctions.id, id),
      with: { seller: true },
    });
    if (!row) throw new NotFoundException(`auction ${id} not found`);
    return row;
  }

  async create(sellerId: string, dto: CreateAuctionDto) {
    const [row] = await this.db
      .insert(auctions)
      .values({
        ...dto,
        sellerId,
        currentPriceCents: dto.startingPriceCents,
      })
      .returning();
    return row;
  }
}
