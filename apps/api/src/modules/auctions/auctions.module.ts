import { Module } from '@nestjs/common';
import { AdminAuctionsController } from './auctions.controller';
import { PublicAuctionsController } from './public-auctions.controller';
import { AuctionsService } from './auctions.service';
import { InvitationsService } from './invitations.service';

@Module({
  controllers: [AdminAuctionsController, PublicAuctionsController],
  providers: [AuctionsService, InvitationsService],
})
export class AuctionsModule {}
