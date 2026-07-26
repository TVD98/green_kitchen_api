export type GeneratedRecipe = {
  title: string;
  description: string;
  time_minutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
  servings: number;
  tags: string[];
  steps: { order: number; text: string }[];
  ingredients: { name: string; quantity: string }[];
  nutrition?: {
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
  };
};

export type RecipeFilters = {
  max_time?: number;
  difficulty?: string;
  tags?: string[];
};
