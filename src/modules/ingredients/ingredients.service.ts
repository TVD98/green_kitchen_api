import { Injectable } from '@nestjs/common';
import { Ingredient } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type IngredientLang = 'vi' | 'en';

export type IngredientDto = {
  id: string;
  canonical_name: string;
  category: string;
  aliases: string[];
};

type IngredientSearchRow = {
  id: string;
  canonicalName: string;
  nameEn: string;
  category: string;
  aliasesVi: string[];
  aliasesEn: string[];
};

@Injectable()
export class IngredientsService {
  constructor(private readonly prisma: PrismaService) {}

  normalizeLang(lang?: string): IngredientLang {
    return lang?.trim().toLowerCase() === 'en' ? 'en' : 'vi';
  }

  async search(q?: string, lang?: string): Promise<IngredientDto[]> {
    const query = q?.trim() ?? '';
    if (!query) {
      return [];
    }

    const locale = this.normalizeLang(lang);
    const pattern = `%${query}%`;
    const rows =
      locale === 'en'
        ? await this.searchEnglish(pattern)
        : await this.searchVietnamese(pattern);

    return rows.map((row) => this.toDto(row, locale));
  }

  async findByNameOrAlias(name: string): Promise<Ingredient | null> {
    const query = name.trim();
    if (!query) {
      return null;
    }

    const rows = await this.prisma.$queryRaw<Ingredient[]>`
      SELECT id, "canonicalName", "nameEn", category, "aliasesVi", "aliasesEn"
      FROM "Ingredient"
      WHERE lower("canonicalName") = lower(${query})
         OR lower("nameEn") = lower(${query})
         OR EXISTS (
           SELECT 1 FROM unnest("aliasesVi") AS alias
           WHERE lower(alias) = lower(${query})
         )
         OR EXISTS (
           SELECT 1 FROM unnest("aliasesEn") AS alias
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

    const aliasesVi =
      alias && alias.trim().toLowerCase() !== canonicalName.trim().toLowerCase()
        ? [alias.trim()]
        : [];

    return this.prisma.ingredient.create({
      data: {
        canonicalName: canonicalName.trim(),
        nameEn: canonicalName.trim(),
        category: 'other',
        aliasesVi,
        aliasesEn: [],
      },
    });
  }

  private async searchVietnamese(
    pattern: string,
  ): Promise<IngredientSearchRow[]> {
    return this.prisma.$queryRaw<IngredientSearchRow[]>`
      SELECT id, "canonicalName", "nameEn", category, "aliasesVi", "aliasesEn"
      FROM "Ingredient"
      WHERE "canonicalName" ILIKE ${pattern}
         OR EXISTS (
           SELECT 1 FROM unnest("aliasesVi") AS alias
           WHERE alias ILIKE ${pattern}
         )
      ORDER BY "canonicalName" ASC
      LIMIT 20
    `;
  }

  private async searchEnglish(
    pattern: string,
  ): Promise<IngredientSearchRow[]> {
    return this.prisma.$queryRaw<IngredientSearchRow[]>`
      SELECT id, "canonicalName", "nameEn", category, "aliasesVi", "aliasesEn"
      FROM "Ingredient"
      WHERE "nameEn" ILIKE ${pattern}
         OR EXISTS (
           SELECT 1 FROM unnest("aliasesEn") AS alias
           WHERE alias ILIKE ${pattern}
         )
      ORDER BY "nameEn" ASC
      LIMIT 20
    `;
  }

  private toDto(row: IngredientSearchRow, lang: IngredientLang): IngredientDto {
    if (lang === 'en') {
      return {
        id: row.id,
        canonical_name: row.nameEn,
        category: row.category,
        aliases: row.aliasesEn,
      };
    }

    return {
      id: row.id,
      canonical_name: row.canonicalName,
      category: row.category,
      aliases: row.aliasesVi,
    };
  }
}
