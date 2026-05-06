import { Module } from '@nestjs/common';
import { AuctionsController } from './auctions.controller';
import { PublicAuctionsController } from './public-auctions.controller';
import { AuctionsService } from './auctions.service';

@Module({
  controllers: [AuctionsController, PublicAuctionsController],
  providers: [AuctionsService],
})
export class AuctionsModule {}
