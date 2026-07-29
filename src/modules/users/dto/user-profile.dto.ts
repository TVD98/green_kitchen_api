import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

export const DIETARY_STYLES = [
  'omnivore',
  'vegetarian',
  'vegan',
  'pescatarian',
] as const;

export const SPICE_LEVELS = ['mild', 'medium', 'hot'] as const;

export class UpdateUserPreferencesDto {
  @IsOptional()
  @IsString()
  @IsIn(DIETARY_STYLES)
  dietary_style?: string;

  @IsOptional()
  @IsString()
  @IsIn(SPICE_LEVELS)
  spice_level?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cuisine_preferences?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  disliked_ingredients?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  health_goals?: string[];
}

export class UpdateUserAllergiesDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  ingredient_ids!: string[];
}
