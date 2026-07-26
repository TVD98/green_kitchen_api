import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Ingredient, Prisma } from '../../../generated/prisma/client';
import { ErrorCodes } from '../../common/codes';
import { DomainException } from '../../common/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { GeminiService } from '../gemini/gemini.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import { RecipeDto } from '../recipes/recipes.mapper';
import { RecipesService } from '../recipes/recipes.service';
import { PantrySearchDto, PantrySearchFiltersDto } from './dto/pantry-search.dto';

@Injectable()
export class PantryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingredients: IngredientsService,
    private readonly gemini: GeminiService,
    private readonly recipes: RecipesService,
  ) {}

  async search(
    dto: PantrySearchDto,
    userId?: string,
  ): Promise<RecipeDto[]> {
    const names = dto.ingredients.map((n) => n.trim()).filter(Boolean);
    if (names.length === 0) {
      throw new DomainException(
        ErrorCodes.INVALID_INPUT,
        400,
        'ingredients must not be empty',
      );
    }

    const resolved = await this.normalizeToIngredients(names);
    const canonicalIds = resolved
      .map((i) => i.id)
      .sort((a, b) => a.localeCompare(b));
    const canonicalNames = resolved.map((i) => i.canonicalName);
    const hash = this.ingredientHash(canonicalIds, dto.filters);

    const cached = await this.prisma.pantryQuery.findUnique({
      where: { ingredientHash: hash },
    });
    if (cached) {
      return this.recipes.findByIds(cached.resultRecipeIds);
    }

    const generated = await this.gemini.generateRecipes(
      canonicalNames,
      dto.filters,
    );
    const saved = await this.recipes.persistGenerated(generated);

    try {
      await this.prisma.pantryQuery.create({
        data: {
          userId: userId ?? null,
          ingredientHash: hash,
          ingredientIds: canonicalIds,
          resultRecipeIds: saved.map((r) => r.id),
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const winner = await this.prisma.pantryQuery.findUnique({
          where: { ingredientHash: hash },
        });
        if (winner) {
          return this.recipes.findByIds(winner.resultRecipeIds);
        }
      }
      throw err;
    }

    return saved;
  }

  private async normalizeToIngredients(
    names: string[],
  ): Promise<Ingredient[]> {
    const matched: Ingredient[] = [];
    const unknowns: string[] = [];

    for (const name of names) {
      const found = await this.ingredients.findByNameOrAlias(name);
      if (found) {
        matched.push(found);
      } else {
        unknowns.push(name);
      }
    }

    if (unknowns.length > 0) {
      const normalized = await this.gemini.normalizeIngredients(unknowns);
      for (let i = 0; i < unknowns.length; i++) {
        const canonical = (normalized[i] ?? unknowns[i]).trim();
        const upserted = await this.ingredients.upsertCanonical(
          canonical,
          unknowns[i],
        );
        matched.push(upserted);
      }
    }

    const uniqueById = new Map<string, Ingredient>();
    for (const ingredient of matched) {
      uniqueById.set(ingredient.id, ingredient);
    }
    return [...uniqueById.values()];
  }

  private ingredientHash(
    sortedCanonicalIds: string[],
    filters?: PantrySearchFiltersDto,
  ): string {
    const payload =
      sortedCanonicalIds.join('|') + JSON.stringify(filters ?? {});
    return createHash('sha256').update(payload).digest('hex');
  }
}
