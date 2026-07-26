import { Injectable } from '@nestjs/common';
import { Ingredient } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type IngredientDto = {
  id: string;
  canonical_name: string;
  category: string;
  aliases: string[];
};

@Injectable()
export class IngredientsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q?: string): Promise<IngredientDto[]> {
    const query = q?.trim() ?? '';
    if (!query) {
      return [];
    }

    const pattern = `%${query}%`;
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        canonicalName: string;
        category: string;
        aliases: string[];
      }>
    >`
      SELECT id, "canonicalName", category, aliases
      FROM "Ingredient"
      WHERE "canonicalName" ILIKE ${pattern}
         OR EXISTS (
           SELECT 1 FROM unnest(aliases) AS alias
           WHERE alias ILIKE ${pattern}
         )
      ORDER BY "canonicalName" ASC
      LIMIT 20
    `;

    return rows.map((row) => ({
      id: row.id,
      canonical_name: row.canonicalName,
      category: row.category,
      aliases: row.aliases,
    }));
  }

  async findByNameOrAlias(name: string): Promise<Ingredient | null> {
    const query = name.trim();
    if (!query) {
      return null;
    }

    const rows = await this.prisma.$queryRaw<Ingredient[]>`
      SELECT id, "canonicalName", category, aliases
      FROM "Ingredient"
      WHERE lower("canonicalName") = lower(${query})
         OR EXISTS (
           SELECT 1 FROM unnest(aliases) AS alias
           WHERE lower(alias) = lower(${query})
         )
      LIMIT 1
    `;

    return rows[0] ?? null;
  }

  async upsertCanonical(
    canonicalName: string,
    alias?: string,
  ): Promise<Ingredient> {
    const existing = await this.findByNameOrAlias(canonicalName);
    if (existing) {
      return existing;
    }

    const aliases =
      alias && alias.trim().toLowerCase() !== canonicalName.trim().toLowerCase()
        ? [alias.trim()]
        : [];

    return this.prisma.ingredient.create({
      data: {
        canonicalName: canonicalName.trim(),
        category: 'other',
        aliases,
      },
    });
  }
}
