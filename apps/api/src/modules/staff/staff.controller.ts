import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('admin/staff')
@Roles('admin')
@Controller('admin/staff')
export class StaffController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.user.findMany({
      where: { role: 'admin' },
      select: {
        id: true,
        name: true,
        email: true,
        mobileCountryCode: true,
        mobileNumber: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}
