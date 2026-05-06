import { Module } from '@nestjs/common';
import { BidderController } from './bidder.controller';
import { BidderAdminController } from './bidder-admin.controller';
import { BidderService } from './bidder.service';
import { BidderAdminService } from './bidder-admin.service';

@Module({
  controllers: [BidderController, BidderAdminController],
  providers: [BidderService, BidderAdminService],
  exports: [BidderService],
})
export class BidderModule {}
