import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { bidderListQuerySchema, type BidderStatus } from '@auction/types';
import { Roles } from '../auth/decorators/roles.decorator';
import { BidderAdminService } from './bidder-admin.service';
import { BidderRejectDto } from './dto/bidder-reject.dto';
import { BidderMarkFeePaidDto } from './dto/bidder-mark-fee-paid.dto';

@ApiTags('admin/bidders')
@Roles('admin')
@Controller('admin/bidder-profiles')
export class BidderAdminController {
  constructor(private readonly admin: BidderAdminService) {}

  @Get()
  list(@Query('status') status?: string) {
    const parsed = bidderListQuerySchema.safeParse({ status });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'invalid query');
    }
    return this.admin.list({ status: parsed.data.status as BidderStatus | undefined });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.findOne(id);
  }

  @Post(':id/mark-fee-paid')
  markFeePaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BidderMarkFeePaidDto,
  ) {
    return this.admin.markFeePaid(id, dto.note);
  }

  @Post(':id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.approve(id);
  }

  @Post(':id/reject')
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: BidderRejectDto) {
    return this.admin.reject(id, dto.note);
  }
}
