import { Type, Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class DiscoverySearchFiltersDto {
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

export class DiscoverySearchOptionsDto {
  @IsOptional()
  @IsBoolean()
  use_preferences?: boolean;

  @IsOptional()
  @IsBoolean()
  exclude_allergies?: boolean;
}

export class DiscoverySearchDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  prompt!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DiscoverySearchOptionsDto)
  options?: DiscoverySearchOptionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DiscoverySearchFiltersDto)
  filters?: DiscoverySearchFiltersDto;
}
