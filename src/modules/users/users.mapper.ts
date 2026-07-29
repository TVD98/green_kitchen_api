import { UserPreferences } from '../../../generated/prisma/client';
import { UserPreferencesContext } from '../gemini/gemini.types';

export type UserPreferencesDto = {
  dietary_style: string | null;
  spice_level: string | null;
  cuisine_preferences: string[];
  disliked_ingredients: string[];
  health_goals: string[];
};

export type UserAllergyDto = {
  ingredient_id: string;
  name: string;
};

export const DEFAULT_USER_PREFERENCES: UserPreferencesDto = {
  dietary_style: null,
  spice_level: null,
  cuisine_preferences: [],
  disliked_ingredients: [],
  health_goals: [],
};

export function toUserPreferencesDto(
  preferences: UserPreferences | null,
): UserPreferencesDto {
  if (!preferences) {
    return { ...DEFAULT_USER_PREFERENCES };
  }

  return {
    dietary_style: preferences.dietaryStyle,
    spice_level: preferences.spiceLevel,
    cuisine_preferences: preferences.cuisinePreferences,
    disliked_ingredients: preferences.dislikedIngredients,
    health_goals: preferences.healthGoals,
  };
}

export function toUserPreferencesContext(
  dto: UserPreferencesDto,
): UserPreferencesContext {
  return {
    dietary_style: dto.dietary_style,
    spice_level: dto.spice_level,
    cuisine_preferences: dto.cuisine_preferences,
    disliked_ingredients: dto.disliked_ingredients,
    health_goals: dto.health_goals,
  };
}
