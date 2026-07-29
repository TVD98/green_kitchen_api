import { Injectable } from '@nestjs/common';
import { ErrorCodes } from '../../common/codes';
import { DomainException } from '../../common/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { UserAllergyDto } from './users.mapper';

@Injectable()
export class UsersAllergiesService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllergies(userId: string): Promise<UserAllergyDto[]> {
    const rows = await this.prisma.userAllergy.findMany({
      where: { userId },
      include: { ingredient: true },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((row) => ({
      ingredient_id: row.ingredientId,
      name: row.ingredient.canonicalName,
    }));
  }

  async replaceAllergies(
    userId: string,
    ingredientIds: string[],
  ): Promise<UserAllergyDto[]> {
    const uniqueIds = [...new Set(ingredientIds.map((id) => id.trim()).filter(Boolean))];

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

    return this.getAllergies(userId);
  }
}
