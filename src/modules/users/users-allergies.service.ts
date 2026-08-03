import { Injectable } from '@nestjs/common';
import { ErrorCodes } from '../../common/codes';
import { DomainException } from '../../common/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { UserAllergyDto } from './users.mapper';

type AllergyLang = 'vi' | 'en';

@Injectable()
export class UsersAllergiesService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeLang(lang?: string): AllergyLang {
    return lang?.trim().toLowerCase() === 'en' ? 'en' : 'vi';
  }

  private toAllergyDto(
    ingredientId: string,
    ingredient: { canonicalName: string; nameEn: string },
    lang: AllergyLang,
  ): UserAllergyDto {
    const nameVi = ingredient.canonicalName;
    const nameEn = ingredient.nameEn?.trim() || ingredient.canonicalName;
    return {
      ingredient_id: ingredientId,
      name: lang === 'en' ? nameEn : nameVi,
      name_vi: nameVi,
      name_en: nameEn,
    };
  }

  async getAllergies(
    userId: string,
    lang?: string,
  ): Promise<UserAllergyDto[]> {
    const locale = this.normalizeLang(lang);
    const rows = await this.prisma.userAllergy.findMany({
      where: { userId },
      include: { ingredient: true },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((row) =>
      this.toAllergyDto(row.ingredientId, row.ingredient, locale),
    );
  }

  async replaceAllergies(
    userId: string,
    ingredientIds: string[],
    lang?: string,
  ): Promise<UserAllergyDto[]> {
    const uniqueIds = [
      ...new Set(ingredientIds.map((id) => id.trim()).filter(Boolean)),
    ];

    if (uniqueIds.length > 0) {
      const found = await this.prisma.ingredient.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true },
      });
      if (found.length !== uniqueIds.length) {
        throw new DomainException(
          ErrorCodes.INVALID_INPUT,
          400,
          'One or more ingredient ids are invalid',
        );
      }
    }

    await this.prisma.$transaction([
      this.prisma.userAllergy.deleteMany({ where: { userId } }),
      ...(uniqueIds.length > 0
        ? [
            this.prisma.userAllergy.createMany({
              data: uniqueIds.map((ingredientId) => ({
                userId,
                ingredientId,
              })),
            }),
          ]
        : []),
    ]);

    return this.getAllergies(userId, lang);
  }
}
