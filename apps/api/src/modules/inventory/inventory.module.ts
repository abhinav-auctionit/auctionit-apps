import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { CategoriesService } from './categories.service';
import { AttributesService } from './attributes.service';
import { ItemsService } from './items.service';

@Module({
  controllers: [InventoryController],
  providers: [CategoriesService, AttributesService, ItemsService],
})
export class InventoryModule {}
