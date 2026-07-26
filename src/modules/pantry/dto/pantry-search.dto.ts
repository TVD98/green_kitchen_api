import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class PantrySearchFiltersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  max_time?: number;

  @IsOptional()
  @IsString()
  difficulty?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class PantrySearchDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ingredients!: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PantrySearchFiltersDto)
  filters?: PantrySearchFiltersDto;
}
