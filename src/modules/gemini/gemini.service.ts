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
  DISCOVERY_PROMPT_SCHEMA,
  NORMALIZE_INGREDIENTS_SCHEMA,
} from './gemini.schema';
import {
  DiscoveryContext,
  DiscoveryParsedIntent,
  GeneratedRecipe,
  RecipeFilters,
} from './gemini.types';

@Injectable()
export class GeminiService {
  private readonly model: GenerativeModel | null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY')?.trim();
    if (apiKey) {
      const client = new GoogleGenerativeAI(apiKey);
      this.model = client.getGenerativeModel({
        model: 'gemini-2.5-flash-lite',
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

  async parseDiscoveryPrompt(prompt: string): Promise<DiscoveryParsedIntent> {
    const model = this.requireModel();
    try {
      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Parse this Vietnamese cooking discovery prompt into structured intent for recipe generation.
Return JSON with:
- "ingredients": suggested or mentioned ingredients (empty array if none)
- "cravings": flavor/mood cravings like spicy, sweet, comfort food (empty array if none)
- "dietary_notes": dietary constraints mentioned in the prompt (empty array if none)

Prompt: ${prompt}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: DISCOVERY_PROMPT_SCHEMA,
        },
      });

      const text = result.response.text();
      const parsed = JSON.parse(text) as Partial<DiscoveryParsedIntent>;
      if (
        !Array.isArray(parsed.ingredients) ||
        !parsed.ingredients.every((item) => typeof item === 'string') ||
        !Array.isArray(parsed.cravings) ||
        !parsed.cravings.every((item) => typeof item === 'string') ||
        !Array.isArray(parsed.dietary_notes) ||
        !parsed.dietary_notes.every((item) => typeof item === 'string')
      ) {
        throw new DomainException(
          ErrorCodes.INTERNAL,
          500,
          'Malformed Gemini discovery parse response',
        );
      }

      const intent: DiscoveryParsedIntent = {
        ingredients: parsed.ingredients.map((item) => item.trim()).filter(Boolean),
        cravings: parsed.cravings.map((item) => item.trim()).filter(Boolean),
        dietary_notes: parsed.dietary_notes
          .map((item) => item.trim())
          .filter(Boolean),
      };

      if (
        intent.ingredients.length === 0 &&
        intent.cravings.length === 0 &&
        intent.dietary_notes.length === 0
      ) {
        throw new DomainException(
          ErrorCodes.INVALID_INPUT,
          400,
          'Could not parse a usable cooking intent from prompt',
        );
      }

      return intent;
    } catch (err) {
      this.rethrowGeminiError(err);
    }
  }

  async generateRecipes(
    ingredients: string[],
    filters?: RecipeFilters,
    context?: DiscoveryContext,
  ): Promise<GeneratedRecipe[]> {
    const model = this.requireModel();
    try {
      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: buildRecipeGenerationPrompt(ingredients, filters, context),
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

export function buildRecipeGenerationPrompt(
  ingredients: string[],
  filters?: RecipeFilters,
  context?: DiscoveryContext,
): string {
  const lines = [
    `Generate 2-4 complete Vietnamese recipes using these ingredients: ${JSON.stringify(ingredients)}.`,
    `Optional filters: ${JSON.stringify(filters ?? {})}.`,
  ];

  if (context?.original_prompt) {
    lines.push(`Original user prompt: ${context.original_prompt}`);
  }
  if (context?.cravings?.length) {
    lines.push(`User cravings: ${JSON.stringify(context.cravings)}.`);
  }
  if (context?.dietary_notes?.length) {
    lines.push(`Dietary notes: ${JSON.stringify(context.dietary_notes)}.`);
  }
  if (context?.preferences) {
    lines.push(`User preferences: ${JSON.stringify(context.preferences)}.`);
  }
  if (context?.excludeIngredients?.length) {
    lines.push(
      `STRICTLY DO NOT use these allergen ingredients: ${JSON.stringify(context.excludeIngredients)}.`,
    );
  }

  lines.push('Return JSON with a "recipes" array matching the schema.');
  return lines.join('\n');
}
