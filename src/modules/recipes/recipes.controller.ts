import { Controller, Get, Param, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { RecipesService } from './recipes.service';

class RecipeSearchDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  max_time?: number;

  @IsOptional()
  @IsString()
  difficulty?: string;

  @IsOptional()
  @IsString()
  tags?: string;
}

@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  search(@Query() query: RecipeSearchDto) {
    return this.recipesService.search(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.recipesService.findById(id);
  }
}
