import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { CategoriesService } from './categories.service';
import { AttributesService } from './attributes.service';
import {
  CreateAttributeDto,
  CreateCategoryDto,
  CreateMicrocategoryDto,
  CreateSubcategoryDto,
  UpdateAttributeDto,
  UpdateCategoryDto,
  UpdateMicrocategoryDto,
  UpdateSubcategoryDto,
} from './dto';

@ApiTags('inventory')
@Roles('admin')
@Controller()
export class InventoryController {
  constructor(
    private readonly categories: CategoriesService,
    private readonly attributes: AttributesService,
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

  @Post('microcategories')
  createMicrocategory(@Body() dto: CreateMicrocategoryDto) {
    return this.categories.createMicrocategory(dto);
  }

  @Patch('microcategories/:id')
  updateMicrocategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMicrocategoryDto,
  ) {
    return this.categories.updateMicrocategory(id, dto);
  }

  @Delete('microcategories/:id')
  deleteMicrocategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.categories.deleteMicrocategory(id);
  }

  @Get('microcategories/:id/suggested-attributes')
  suggestedAttributes(@Param('id', ParseUUIDPipe) id: string) {
    return this.categories.suggestedAttributes(id);
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
}
