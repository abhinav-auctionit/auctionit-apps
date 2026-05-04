import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { CategoriesService } from './categories.service';
import { AttributesService } from './attributes.service';
import { ItemsService } from './items.service';
import {
  CreateAttributeDto,
  CreateCategoryDto,
  CreateItemDto,
  CreateSubcategoryDto,
  ItemAttributeValueInputDto,
  UpdateAttributeDto,
  UpdateCategoryDto,
  UpdateItemDto,
  UpdateSubcategoryDto,
} from './dto';

@ApiTags('taxonomy')
@Roles('admin')
@Controller()
export class TaxonomyController {
  constructor(
    private readonly categories: CategoriesService,
    private readonly attributes: AttributesService,
    private readonly items: ItemsService,
  ) {}

  @Get('categories')
  listCategories() {
    return this.categories.listWithCounts();
  }

  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.categories.createCategory(dto);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.categories.deleteCategory(id);
  }

  @Post('subcategories')
  createSubcategory(@Body() dto: CreateSubcategoryDto) {
    return this.categories.createSubcategory(dto);
  }

  @Patch('subcategories/:id')
  updateSubcategory(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSubcategoryDto) {
    return this.categories.updateSubcategory(id, dto);
  }

  @Delete('subcategories/:id')
  deleteSubcategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.categories.deleteSubcategory(id);
  }

  @Get('subcategories/:id/suggested-attributes')
  suggestedAttributes(@Param('id', ParseUUIDPipe) id: string) {
    return this.items.suggestedAttributes(id);
  }

  @Get('attributes')
  listAttributes() {
    return this.attributes.list();
  }

  @Get('attributes/:id')
  getAttribute(@Param('id', ParseUUIDPipe) id: string) {
    return this.attributes.findOne(id);
  }

  @Post('attributes')
  createAttribute(@Body() dto: CreateAttributeDto) {
    return this.attributes.create(dto);
  }

  @Patch('attributes/:id')
  updateAttribute(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAttributeDto) {
    return this.attributes.update(id, dto);
  }

  @Delete('attributes/:id')
  deleteAttribute(@Param('id', ParseUUIDPipe) id: string) {
    return this.attributes.delete(id);
  }

  @Get('items')
  listItems(
    @Query('subcategoryId') subcategoryId?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.items.list({ subcategoryId, categoryId });
  }

  @Get('items/:id')
  getItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.items.findOne(id);
  }

  @Post('items')
  createItem(@Body() dto: CreateItemDto) {
    return this.items.create(dto);
  }

  @Patch('items/:id')
  updateItem(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateItemDto) {
    return this.items.update(id, dto);
  }

  @Delete('items/:id')
  deleteItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.items.delete(id);
  }

  @Post('items/:id/attribute-values')
  addItemAttributeValue(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ItemAttributeValueInputDto,
  ) {
    return this.items.addAttributeValue(id, dto);
  }

  @Delete('items/:id/attribute-values/:valueId')
  removeItemAttributeValue(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('valueId', ParseUUIDPipe) valueId: string,
  ) {
    return this.items.removeAttributeValue(id, valueId);
  }
}
