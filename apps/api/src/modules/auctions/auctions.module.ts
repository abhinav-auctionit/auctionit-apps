import { Module } from '@nestjs/common';
import { AdminAuctionsController } from './auctions.controller';
import { PublicAuctionsController } from './public-auctions.controller';
import { AuctionsService } from './auctions.service';
import { ParticipantsService } from './participants.service';
import { AuctionLifecycleService } from './auction-lifecycle.service';
import { BidderModule } from '../bidder/bidder.module';

@Module({
  imports: [BidderModule],
  controllers: [AdminAuctionsController, PublicAuctionsController],
  providers: [AuctionsService, ParticipantsService, AuctionLifecycleService],
})
export class AuctionsModule {}
