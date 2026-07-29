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

export type DiscoveryParsedIntent = {
  ingredients: string[];
  cravings: string[];
  dietary_notes: string[];
};

export type UserPreferencesContext = {
  dietary_style?: string | null;
  spice_level?: string | null;
  cuisine_preferences?: string[];
  disliked_ingredients?: string[];
  health_goals?: string[];
};

export type DiscoveryContext = {
  preferences?: UserPreferencesContext;
  excludeIngredients?: string[];
  cravings?: string[];
  dietary_notes?: string[];
  original_prompt?: string;
};
