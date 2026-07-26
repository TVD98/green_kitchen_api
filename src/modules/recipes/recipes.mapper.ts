import { Recipe } from '../../../generated/prisma/client';

export type RecipeDto = {
  id: string;
  title: string;
  slug: string;
  description: string;
  time_minutes: number;
  difficulty: string;
  servings: number;
  tags: string[];
  steps: { order: number; text: string }[];
  ingredients: { name: string; quantity: string }[];
  nutrition: {
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
  } | null;
  source: string;
  created_at: string;
};

export function toRecipeDto(recipe: Recipe): RecipeDto {
  return {
    id: recipe.id,
    title: recipe.title,
    slug: recipe.slug,
    description: recipe.description,
    time_minutes: recipe.timeMinutes,
    difficulty: recipe.difficulty,
    servings: recipe.servings,
    tags: recipe.tags,
    steps: recipe.steps as { order: number; text: string }[],
    ingredients: recipe.ingredients as { name: string; quantity: string }[],
    nutrition: (recipe.nutrition as RecipeDto['nutrition']) ?? null,
    source: recipe.source,
    created_at: recipe.createdAt.toISOString(),
  };
}
