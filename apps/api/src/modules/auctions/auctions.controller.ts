import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { auctionListQuerySchema } from '@auction/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { SafeUser } from '../auth/session.service';
import { AuctionsService } from './auctions.service';
import { InvitationsService } from './invitations.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { UpdateAuctionDto } from './dto/update-auction.dto';
import { CreateLotDto } from './dto/create-lot.dto';
import { UpdateLotDto } from './dto/update-lot.dto';
import { InviteBiddersDto } from './dto/invite-bidders.dto';

@ApiTags('admin/auctions')
@Roles('admin')
@Controller('admin/auctions')
export class AdminAuctionsController {
  constructor(
    private readonly auctions: AuctionsService,
    private readonly invitations: InvitationsService,
  ) {}

  @Get()
  list(@Query() query: Record<string, string>) {
    const parsed = auctionListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'invalid query');
    }
    return this.auctions.list(parsed.data);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.auctions.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAuctionDto, @CurrentUser() user: SafeUser) {
    return this.auctions.create(dto, user.id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAuctionDto) {
    return this.auctions.update(id, dto);
  }

  // -- Lots ------------------------------------------------------------------

  @Post(':id/lots')
  addLot(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateLotDto) {
    return this.auctions.addLot(id, dto);
  }

  @Patch(':id/lots/:lotId')
  updateLot(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lotId', ParseUUIDPipe) lotId: string,
    @Body() dto: UpdateLotDto,
  ) {
    return this.auctions.updateLot(id, lotId, dto);
  }

  @Delete(':id/lots/:lotId')
  @HttpCode(204)
  deleteLot(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lotId', ParseUUIDPipe) lotId: string,
  ) {
    return this.auctions.deleteLot(id, lotId);
  }

  // -- Invitations -----------------------------------------------------------

  @Get(':id/invitations')
  listInvitations(@Param('id', ParseUUIDPipe) id: string) {
    return this.invitations.list(id);
  }

  @Post(':id/invitations')
  invite(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InviteBiddersDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.invitations.invite(id, dto.bidderProfileIds, user.id);
  }

  @Delete(':id/invitations/:invitationId')
  @HttpCode(204)
  uninvite(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    return this.invitations.uninvite(id, invitationId);
  }
}
