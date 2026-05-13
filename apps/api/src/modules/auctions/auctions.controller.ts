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
import { ParticipantsService } from './participants.service';
import { AuctionLifecycleService } from './auction-lifecycle.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { UpdateAuctionDto } from './dto/update-auction.dto';
import { CreateLotDto } from './dto/create-lot.dto';
import { UpdateLotDto } from './dto/update-lot.dto';
import { AttachToLotsDto } from './dto/attach-to-lots.dto';
import { AttachToConsolidatedDto } from './dto/attach-to-consolidated.dto';
import { LotOutcomeNoteDto } from './dto/lot-outcome-note.dto';

@ApiTags('admin/auctions')
@Roles('admin')
@Controller('admin/auctions')
export class AdminAuctionsController {
  constructor(
    private readonly auctions: AuctionsService,
    private readonly participants: ParticipantsService,
    private readonly lifecycle: AuctionLifecycleService,
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

  // -- Participants ----------------------------------------------------------

  @Get(':id/participants')
  listParticipants(@Param('id', ParseUUIDPipe) id: string) {
    return this.participants.listParticipants(id);
  }

  @Post(':id/participants/lots')
  attachToLots(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachToLotsDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.participants.attachToLots(id, dto, user.id);
  }

  @Post(':id/participants/consolidated')
  attachToConsolidated(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachToConsolidatedDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.participants.attachToAuctionConsolidated(id, dto, user.id);
  }

  @Delete(':id/lots/:lotId/participants/:bidderProfileId')
  @HttpCode(204)
  detachFromLot(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lotId', ParseUUIDPipe) lotId: string,
    @Param('bidderProfileId', ParseUUIDPipe) bidderProfileId: string,
    @CurrentUser() user: SafeUser,
  ) {
    return this.participants.detachFromLot(id, lotId, bidderProfileId, user.id);
  }

  @Delete(':id/participants/:bidderProfileId')
  @HttpCode(204)
  detachFromAuction(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('bidderProfileId', ParseUUIDPipe) bidderProfileId: string,
    @CurrentUser() user: SafeUser,
  ) {
    return this.participants.detachFromAuction(id, bidderProfileId, user.id);
  }

  // -- Lifecycle (end + cancel + per-lot outcomes) ---------------------------

  @Post(':id/end')
  end(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.lifecycle.endAuction(id, user.id);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LotOutcomeNoteDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.lifecycle.cancelAuction(id, dto.note ?? null, user.id);
  }

  @Post(':id/lots/:lotId/mark-lifted')
  markLotLifted(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lotId', ParseUUIDPipe) lotId: string,
    @Body() dto: LotOutcomeNoteDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.lifecycle.markLotLifted(id, lotId, dto.note ?? null, user.id);
  }

  @Post(':id/lots/:lotId/forfeit')
  forfeitLot(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lotId', ParseUUIDPipe) lotId: string,
    @Body() dto: LotOutcomeNoteDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.lifecycle.forfeitLot(id, lotId, dto.note ?? null, user.id);
  }

  @Post(':id/lots/:lotId/reject-by-client')
  rejectLotByClient(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lotId', ParseUUIDPipe) lotId: string,
    @Body() dto: LotOutcomeNoteDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.lifecycle.rejectLotByClient(id, lotId, dto.note ?? null, user.id);
  }
}
