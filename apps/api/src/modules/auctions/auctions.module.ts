import { Module } from '@nestjs/common';
import { AdminAuctionsController } from './auctions.controller';
import { PublicAuctionsController } from './public-auctions.controller';
import { BiddingController } from './bidding.controller';
import { AuctionsService } from './auctions.service';
import { ParticipantsService } from './participants.service';
import { AuctionLifecycleService } from './auction-lifecycle.service';
import { AuctionSchedulerService } from './auction-scheduler.service';
import { BidsService } from './bids.service';
import { BidderModule } from '../bidder/bidder.module';

@Module({
  imports: [BidderModule],
  controllers: [AdminAuctionsController, PublicAuctionsController, BiddingController],
  providers: [
    AuctionsService,
    ParticipantsService,
    AuctionLifecycleService,
    AuctionSchedulerService,
    BidsService,
  ],
})
export class AuctionsModule {}
