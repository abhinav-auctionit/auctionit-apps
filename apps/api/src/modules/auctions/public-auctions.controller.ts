import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { AuctionsService } from './auctions.service';

@ApiTags('public')
@Controller('public/auctions')
export class PublicAuctionsController {
  constructor(private readonly auctions: AuctionsService) {}

  @Public()
  @Get('upcoming')
  // 60s shared cache; tune later as traffic dictates.
  @Header('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300')
  upcoming() {
    return this.auctions.listUpcomingPublic();
  }
}
