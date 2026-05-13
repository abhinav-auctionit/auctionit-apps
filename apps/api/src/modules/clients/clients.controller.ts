import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { SafeUser } from '../auth/session.service';
import { ClientsService } from './clients.service';
import { ClientCreateDto } from './dto/client-create.dto';
import { ClientLocationCreateDto } from './dto/client-location-create.dto';
import { ClientLocationUpdateDto } from './dto/client-location-update.dto';
import { ClientContactCreateDto } from './dto/client-contact-create.dto';
import { ClientContactUpdateDto } from './dto/client-contact-update.dto';
import { ClientEngagementCreateDto } from './dto/client-engagement-create.dto';
import { ClientEngagementUpdateDto } from './dto/client-engagement-update.dto';
import { InternalContactsUpdateDto } from './dto/internal-contacts-update.dto';

@ApiTags('admin/clients')
@Roles('admin')
@Controller('admin/clients')
export class ClientsAdminController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  list() {
    return this.clients.list();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clients.findOne(id);
  }

  @Post()
  create(@Body() dto: ClientCreateDto, @CurrentUser() user: SafeUser) {
    return this.clients.create(dto, user.id);
  }

  // -- Locations -------------------------------------------------------------

  @Get(':id/locations')
  listLocations(@Param('id', ParseUUIDPipe) id: string) {
    return this.clients.listLocations(id);
  }

  @Post(':id/locations')
  createLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClientLocationCreateDto,
  ) {
    return this.clients.createLocation(id, dto);
  }

  @Patch(':id/locations/:locationId')
  updateLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body() dto: ClientLocationUpdateDto,
  ) {
    return this.clients.updateLocation(id, locationId, dto);
  }

  @Delete(':id/locations/:locationId')
  @HttpCode(204)
  deleteLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
  ) {
    return this.clients.deleteLocation(id, locationId);
  }

  // -- Contact points --------------------------------------------------------

  @Post(':id/locations/:locationId/contacts')
  createContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body() dto: ClientContactCreateDto,
  ) {
    return this.clients.createContact(id, locationId, dto);
  }

  @Patch(':id/locations/:locationId/contacts/:contactId')
  updateContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: ClientContactUpdateDto,
  ) {
    return this.clients.updateContact(id, locationId, contactId, dto);
  }

  @Delete(':id/locations/:locationId/contacts/:contactId')
  @HttpCode(204)
  deleteContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.clients.deleteContact(id, locationId, contactId);
  }

  // -- Auction history -------------------------------------------------------

  @Get(':id/auction-history')
  getAuctionHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.clients.getAuctionHistory(id);
  }

  // -- Internal contacts -----------------------------------------------------

  @Get(':id/internal-contacts')
  listInternalContacts(@Param('id', ParseUUIDPipe) id: string) {
    return this.clients.listInternalContacts(id);
  }

  @Put(':id/internal-contacts')
  setInternalContacts(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InternalContactsUpdateDto,
  ) {
    return this.clients.setInternalContacts(id, dto);
  }

  // -- Engagements -----------------------------------------------------------

  @Get(':id/engagements')
  listEngagements(@Param('id', ParseUUIDPipe) id: string) {
    return this.clients.listEngagements(id);
  }

  @Post(':id/engagements')
  createEngagement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClientEngagementCreateDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.clients.createEngagement(id, dto, user.id);
  }

  @Patch(':id/engagements/:engagementId')
  updateEngagement(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('engagementId', ParseUUIDPipe) engagementId: string,
    @Body() dto: ClientEngagementUpdateDto,
  ) {
    return this.clients.updateEngagement(id, engagementId, dto);
  }

  @Delete(':id/engagements/:engagementId')
  @HttpCode(204)
  deleteEngagement(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('engagementId', ParseUUIDPipe) engagementId: string,
  ) {
    return this.clients.deleteEngagement(id, engagementId);
  }
}
