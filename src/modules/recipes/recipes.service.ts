import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Prisma } from '../../../generated/prisma/client';
import { ErrorCodes } from '../../common/codes';
import { DomainException } from '../../common/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { GeneratedRecipe } from '../gemini/gemini.types';
import { RecipeDto, toRecipeDto } from './recipes.mapper';

export type RecipeSearchQuery = {
  q?: string;
  max_time?: number;
  difficulty?: string;
  tags?: string;
};

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: RecipeSearchQuery): Promise<RecipeDto[]> {
    const where: Prisma.RecipeWhereInput = {};

    const q = query.q?.trim();
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (query.max_time !== undefined && !Number.isNaN(query.max_time)) {
      where.timeMinutes = { lte: query.max_time };
    }

    if (query.difficulty?.trim()) {
      where.difficulty = query.difficulty.trim().toLowerCase();
    }

    if (query.tags?.trim()) {
      const tags = query.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      if (tags.length > 0) {
        where.tags = { hasEvery: tags };
      }
    }

    const rows = await this.prisma.recipe.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return rows.map(toRecipeDto);
  }

  async findById(id: string): Promise<RecipeDto> {
    const recipe = await this.prisma.recipe.findUnique({ where: { id } });
    if (!recipe) {
      throw new DomainException(
        ErrorCodes.INVALID_INPUT,
        404,
        'Recipe not found',
      );
    }
    return toRecipeDto(recipe);
  }

  async findByIds(ids: string[]): Promise<RecipeDto[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.prisma.recipe.findMany({
      where: { id: { in: ids } },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids
      .map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map(toRecipeDto);
  }

  async persistGenerated(recipes: GeneratedRecipe[]): Promise<RecipeDto[]> {
    const saved: RecipeDto[] = [];
    for (const recipe of recipes) {
      const slug = await this.uniqueSlug(this.slugify(recipe.title));
      const created = await this.prisma.recipe.create({
        data: {
          title: recipe.title,
          slug,
          description: recipe.description,
          timeMinutes: recipe.time_minutes,
          difficulty: recipe.difficulty,
          servings: recipe.servings,
          tags: recipe.tags,
          steps: recipe.steps as Prisma.InputJsonValue,
          ingredients: recipe.ingredients as Prisma.InputJsonValue,
          nutrition: (recipe.nutrition ??
            undefined) as Prisma.InputJsonValue | undefined,
          source: 'gemini',
        },
      });
      saved.push(toRecipeDto(created));
    }
    return saved;
  }

  slugify(title: string): string {
    const base = title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return base || 'recipe';
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    for (let attempt = 0; attempt < 20; attempt++) {
      const existing = await this.prisma.recipe.findUnique({
        where: { slug },
      });
      if (!existing) {
        return slug;
      }
      slug = `${base}-${randomBytes(3).toString('hex')}`;
    }
    return `${base}-${Date.now().toString(36)}`;
  }
}
