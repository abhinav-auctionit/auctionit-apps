import { Module } from '@nestjs/common';
import { ClientsAdminController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  controllers: [ClientsAdminController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
