import { Module } from '@nestjs/common';
import { GeminiModule } from '../gemini/gemini.module';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { RecipesModule } from '../recipes/recipes.module';
import { PantryController } from './pantry.controller';
import { PantryService } from './pantry.service';

@Module({
  imports: [GeminiModule, IngredientsModule, RecipesModule],
  controllers: [PantryController],
  providers: [PantryService],
})
export class PantryModule {}
