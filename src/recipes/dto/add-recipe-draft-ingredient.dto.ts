import {
  IsDefined,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class MacrosPer100Dto {
  @IsNumber()
  kcal100!: number;

  @IsNumber()
  protein100!: number;

  @IsNumber()
  fat100!: number;

  @IsNumber()
  carbs100!: number;
}

class RecipeDraftIngredientInputDto {
  @IsOptional()
  @IsString()
  originalText?: string | null;

  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber()
  amount?: number | null;

  @IsOptional()
  @IsString()
  unit?: string | null;

  @IsOptional()
  @IsString()
  productId?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => MacrosPer100Dto)
  macrosPer100?: MacrosPer100Dto | null;

  @IsOptional()
  @IsObject()
  assumptions?: Record<string, unknown> | null;

  @IsOptional()
  @IsInt()
  order?: number | null;
}

export class AddRecipeDraftIngredientDto {
  @IsString()
  draftId!: string;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => RecipeDraftIngredientInputDto)
  ingredient!: RecipeDraftIngredientInputDto;
}
