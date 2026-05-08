import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { SafeUser } from '../auth/session.service';
import { ClientsService } from './clients.service';
import { ClientCreateDto } from './dto/client-create.dto';

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
}
