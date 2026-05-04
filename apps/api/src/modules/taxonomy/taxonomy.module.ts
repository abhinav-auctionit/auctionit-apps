import { Module } from '@nestjs/common';
import { TaxonomyController } from './taxonomy.controller';
import { CategoriesService } from './categories.service';
import { AttributesService } from './attributes.service';
import { ItemsService } from './items.service';

@Module({
  controllers: [TaxonomyController],
  providers: [CategoriesService, AttributesService, ItemsService],
})
export class TaxonomyModule {}
