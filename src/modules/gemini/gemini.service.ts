import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  type GenerativeModel,
} from '@google/generative-ai';
import { ErrorCodes } from '../../common/codes';
import { DomainException } from '../../common/domain.exception';
import {
  GENERATED_RECIPES_SCHEMA,
  NORMALIZE_INGREDIENTS_SCHEMA,
} from './gemini.schema';
import { GeneratedRecipe, RecipeFilters } from './gemini.types';

@Injectable()
export class GeminiService {
  private readonly model: GenerativeModel | null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY')?.trim();
    if (apiKey) {
      const client = new GoogleGenerativeAI(apiKey);
      this.model = client.getGenerativeModel({
        model: 'gemini-2.0-flash',
      });
    } else {
      this.model = null;
    }
  }

  async normalizeIngredients(names: string[]): Promise<string[]> {
    if (names.length === 0) {
      return [];
    }

    const model = this.requireModel();
    try {
      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Normalize these free-text cooking ingredient names to canonical Vietnamese common names. Return JSON with a "names" array of the same length, one canonical name per input, preserving order.\nInputs: ${JSON.stringify(names)}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: NORMALIZE_INGREDIENTS_SCHEMA,
        },
      });

      const text = result.response.text();
      const parsed = JSON.parse(text) as { names?: unknown };
      if (
        !Array.isArray(parsed.names) ||
        parsed.names.length !== names.length ||
        !parsed.names.every((n) => typeof n === 'string')
      ) {
        throw new DomainException(
          ErrorCodes.INTERNAL,
          500,
          'Malformed Gemini normalize response',
        );
      }
      return parsed.names as string[];
    } catch (err) {
      this.rethrowGeminiError(err);
    }
  }

  async generateRecipes(
    ingredients: string[],
    filters?: RecipeFilters,
  ): Promise<GeneratedRecipe[]> {
    const model = this.requireModel();
    try {
      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Generate 2-4 complete Vietnamese recipes using these ingredients: ${JSON.stringify(ingredients)}.
Optional filters: ${JSON.stringify(filters ?? {})}.
Return JSON with a "recipes" array matching the schema.`,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: GENERATED_RECIPES_SCHEMA,
        },
      });

      const text = result.response.text();
      return this.parseRecipes(text);
    } catch (err) {
      this.rethrowGeminiError(err);
    }
  }

  private parseRecipes(text: string): GeneratedRecipe[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new DomainException(
        ErrorCodes.INTERNAL,
        500,
        'Malformed Gemini recipe response',
      );
    }

    const recipes = (parsed as { recipes?: unknown }).recipes;
    if (!Array.isArray(recipes) || recipes.length === 0) {
      throw new DomainException(
        ErrorCodes.INTERNAL,
        500,
        'Malformed Gemini recipe response',
      );
    }

    for (const recipe of recipes) {
      if (!this.isGeneratedRecipe(recipe)) {
        throw new DomainException(
          ErrorCodes.INTERNAL,
          500,
          'Malformed Gemini recipe response',
        );
      }
    }

    return recipes as GeneratedRecipe[];
  }

  private isGeneratedRecipe(value: unknown): value is GeneratedRecipe {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const r = value as Record<string, unknown>;
    return (
      typeof r.title === 'string' &&
      typeof r.description === 'string' &&
      typeof r.time_minutes === 'number' &&
      (r.difficulty === 'easy' ||
        r.difficulty === 'medium' ||
        r.difficulty === 'hard') &&
      typeof r.servings === 'number' &&
      Array.isArray(r.tags) &&
      r.tags.every((t) => typeof t === 'string') &&
      Array.isArray(r.steps) &&
      r.steps.every(
        (s) =>
          typeof s === 'object' &&
          s !== null &&
          typeof (s as { order?: unknown }).order === 'number' &&
          typeof (s as { text?: unknown }).text === 'string',
      ) &&
      Array.isArray(r.ingredients) &&
      r.ingredients.every(
        (ing) =>
          typeof ing === 'object' &&
          ing !== null &&
          typeof (ing as { name?: unknown }).name === 'string' &&
          typeof (ing as { quantity?: unknown }).quantity === 'string',
      )
    );
  }

  private requireModel(): GenerativeModel {
    if (!this.model) {
      throw new DomainException(
        ErrorCodes.INTERNAL,
        500,
        'GEMINI_API_KEY is not configured',
      );
    }
    return this.model;
  }

  private rethrowGeminiError(err: unknown): never {
    if (err instanceof DomainException) {
      throw err;
    }

    const message =
      err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    const status =
      typeof err === 'object' &&
      err !== null &&
      'status' in err &&
      typeof (err as { status: unknown }).status === 'number'
        ? (err as { status: number }).status
        : undefined;

    if (
      status === 429 ||
      message.includes('quota') ||
      message.includes('rate limit') ||
      message.includes('resource_exhausted')
    ) {
      throw new DomainException(
        ErrorCodes.TOO_MANY_REQUESTS,
        429,
        'Gemini rate limit exceeded',
      );
    }

    throw new DomainException(
      ErrorCodes.INTERNAL,
      500,
      'Gemini request failed',
    );
  }
}
