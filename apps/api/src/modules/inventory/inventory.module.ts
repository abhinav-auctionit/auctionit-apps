import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { CategoriesService } from './categories.service';
import { AttributesService } from './attributes.service';

@Module({
  controllers: [InventoryController],
  providers: [CategoriesService, AttributesService],
})
export class InventoryModule {}
