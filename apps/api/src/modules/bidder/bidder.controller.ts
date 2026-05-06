import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { SafeUser } from '../auth/session.service';
import { BidderService } from './bidder.service';
import { BidderProfilePatchDto } from './dto/bidder-profile-patch.dto';
import { STATES_BY_COUNTRY } from './constants';

@ApiTags('bidder')
@Controller('bidder')
export class BidderController {
  constructor(private readonly bidder: BidderService) {}

  @Public()
  @Get('countries')
  @HttpCode(200)
  countries() {
    return STATES_BY_COUNTRY;
  }

  @Roles('bidder', 'admin')
  @Get('me/profile')
  getMine(@CurrentUser() user: SafeUser) {
    return this.bidder.getMyProfile(user);
  }

  @Roles('bidder')
  @Patch('me/profile')
  patchMine(@CurrentUser() user: SafeUser, @Body() dto: BidderProfilePatchDto) {
    return this.bidder.patchMyProfile(user, dto);
  }

  @Roles('bidder')
  @Post('me/profile/submit')
  submitMine(@CurrentUser() user: SafeUser) {
    return this.bidder.submit(user);
  }
}
