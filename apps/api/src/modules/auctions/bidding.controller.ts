import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { SafeUser } from '../auth/session.service';
import { BidsService } from './bids.service';
import { PlaceBidDto } from './dto/place-bid.dto';

@ApiTags('bidder/auctions')
@Roles('bidder')
@Controller('bidder/auctions')
export class BiddingController {
  constructor(private readonly bids: BidsService) {}

  @Get(':id/lots/:lotId/state')
  getLotState(
    @Param('id', ParseUUIDPipe) auctionId: string,
    @Param('lotId', ParseUUIDPipe) lotId: string,
    @CurrentUser() user: SafeUser,
  ) {
    return this.bids.getLotState(auctionId, lotId, user.id);
  }

  @Post(':id/lots/:lotId/bids')
  placeBid(
    @Param('id', ParseUUIDPipe) auctionId: string,
    @Param('lotId', ParseUUIDPipe) lotId: string,
    @Body() dto: PlaceBidDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.bids.placeBid(auctionId, lotId, user.id, dto);
  }
}
