import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '../../../generated/prisma/client';
import { ErrorCodes } from '../../common/codes';
import { DomainException } from '../../common/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { DiscoveryContext, DiscoveryParsedIntent } from '../gemini/gemini.types';
import { GeminiService } from '../gemini/gemini.service';
import { RecipeDto } from '../recipes/recipes.mapper';
import { RecipesService } from '../recipes/recipes.service';
import { UsersAllergiesService } from '../users/users-allergies.service';
import { UsersPreferencesService } from '../users/users-preferences.service';
import { toUserPreferencesContext } from '../users/users.mapper';
import {
  DiscoverySearchDto,
  DiscoverySearchFiltersDto,
  DiscoverySearchOptionsDto,
} from './dto/discovery-search.dto';

type DiscoveryCachePayload = {
  prompt_normalized: string;
  filters: Record<string, unknown>;
  options: {
    use_preferences: boolean;
    exclude_allergies: boolean;
  };
  preference_snapshot: ReturnType<typeof toUserPreferencesContext> | null;
  allergy_ids: string[] | null;
};

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly recipes: RecipesService,
    private readonly preferencesService: UsersPreferencesService,
    private readonly allergiesService: UsersAllergiesService,
  ) {}

  async search(dto: DiscoverySearchDto, userId: string): Promise<RecipeDto[]> {
    const prompt = dto.prompt.trim();
    if (!prompt) {
      throw new DomainException(
        ErrorCodes.INVALID_INPUT,
        400,
        'prompt must not be empty',
      );
    }

    const options = this.resolveOptions(dto.options);
    const parsed = await this.gemini.parseDiscoveryPrompt(prompt);

    const preferences = options.use_preferences
      ? toUserPreferencesContext(
          await this.preferencesService.getPreferences(userId),
        )
      : undefined;

    const allergies = options.exclude_allergies
      ? await this.allergiesService.getAllergies(userId)
      : [];

    const hash = this.promptHash({
      prompt_normalized: normalizePrompt(prompt),
      filters: this.serializeFilters(dto.filters),
      options: {
        use_preferences: options.use_preferences,
        exclude_allergies: options.exclude_allergies,
      },
      preference_snapshot: options.use_preferences
        ? (preferences ?? null)
        : null,
      allergy_ids: options.exclude_allergies
        ? allergies.map((item) => item.ingredient_id).sort()
        : null,
    });

    const cached = await this.prisma.discoveryQuery.findUnique({
      where: { promptHash: hash },
    });
    if (cached) {
      return this.recipes.findByIds(cached.resultRecipeIds);
    }

    const generationIngredients = this.buildGenerationIngredients(parsed);
    const context: DiscoveryContext = {
      original_prompt: prompt,
      cravings: parsed.cravings,
      dietary_notes: parsed.dietary_notes,
      preferences,
      excludeIngredients: options.exclude_allergies
        ? allergies.map((item) => item.name)
        : undefined,
    };

    const generated = await this.gemini.generateRecipes(
      generationIngredients,
      dto.filters,
      context,
    );
    const saved = await this.recipes.persistGenerated(generated);

    try {
      await this.prisma.discoveryQuery.create({
        data: {
          userId,
          promptHash: hash,
          prompt,
          options: options as unknown as Prisma.InputJsonValue,
          filters: (dto.filters ?? undefined) as Prisma.InputJsonValue | undefined,
          resultRecipeIds: saved.map((recipe) => recipe.id),
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const winner = await this.prisma.discoveryQuery.findUnique({
          where: { promptHash: hash },
        });
        if (winner) {
          return this.recipes.findByIds(winner.resultRecipeIds);
        }
      }
      throw err;
    }

    return saved;
  }

  buildGenerationIngredients(parsed: DiscoveryParsedIntent): string[] {
    if (parsed.ingredients.length > 0) {
      return parsed.ingredients;
    }
    return parsed.cravings.length > 0 ? parsed.cravings : parsed.dietary_notes;
  }

  resolveOptions(options?: DiscoverySearchOptionsDto): {
    use_preferences: boolean;
    exclude_allergies: boolean;
  } {
    return {
      use_preferences: options?.use_preferences ?? false,
      exclude_allergies: options?.exclude_allergies ?? false,
    };
  }

  promptHash(payload: DiscoveryCachePayload): string {
    return createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  serializeFilters(filters?: DiscoverySearchFiltersDto): Record<string, unknown> {
    if (!filters) {
      return {};
    }
    const ordered: Record<string, unknown> = {};
    for (const key of Object.keys(filters).sort()) {
      const value = (filters as Record<string, unknown>)[key];
      if (value !== undefined) {
        ordered[key] = value;
      }
    }
    return ordered;
  }
}

export function normalizePrompt(prompt: string): string {
  return prompt.trim().replace(/\s+/g, ' ').toLowerCase();
}
