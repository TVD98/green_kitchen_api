import { Controller, Get, Query } from '@nestjs/common';
import { IngredientsService } from './ingredients.service';

@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Get()
  search(@Query('q') q?: string, @Query('lang') lang?: string) {
    return this.ingredientsService.search(q, lang);
  }
}
