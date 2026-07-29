import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserPreferencesDto } from './dto/user-profile.dto';
import {
  DEFAULT_USER_PREFERENCES,
  toUserPreferencesDto,
  UserPreferencesDto,
} from './users.mapper';

@Injectable()
export class UsersPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async getPreferences(userId: string): Promise<UserPreferencesDto> {
    const row = await this.prisma.userPreferences.findUnique({
      where: { userId },
    });
    return toUserPreferencesDto(row);
  }

  async updatePreferences(
    userId: string,
    dto: UpdateUserPreferencesDto,
  ): Promise<UserPreferencesDto> {
    const current = await this.getPreferences(userId);
    const merged: UserPreferencesDto = {
      dietary_style:
        dto.dietary_style !== undefined
          ? dto.dietary_style
          : current.dietary_style,
      spice_level:
        dto.spice_level !== undefined ? dto.spice_level : current.spice_level,
      cuisine_preferences:
        dto.cuisine_preferences ?? current.cuisine_preferences,
      disliked_ingredients:
        dto.disliked_ingredients ?? current.disliked_ingredients,
      health_goals: dto.health_goals ?? current.health_goals,
    };

    const saved = await this.prisma.userPreferences.upsert({
      where: { userId },
      create: {
        userId,
        dietaryStyle: merged.dietary_style,
        spiceLevel: merged.spice_level,
        cuisinePreferences: merged.cuisine_preferences,
        dislikedIngredients: merged.disliked_ingredients,
        healthGoals: merged.health_goals,
      },
      update: {
        dietaryStyle: merged.dietary_style,
        spiceLevel: merged.spice_level,
        cuisinePreferences: merged.cuisine_preferences,
        dislikedIngredients: merged.disliked_ingredients,
        healthGoals: merged.health_goals,
      },
    });

    return toUserPreferencesDto(saved);
  }

  emptyPreferences(): UserPreferencesDto {
    return { ...DEFAULT_USER_PREFERENCES };
  }
}
