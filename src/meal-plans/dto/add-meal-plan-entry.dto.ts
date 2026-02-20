import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, Matches, ValidateIf } from "class-validator";

export class AddMealPlanEntryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @IsString()
  slot!: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  recipeId?: string;

  @ValidateIf((value: AddMealPlanEntryDto) => Boolean(value.productId))
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @ValidateIf((value: AddMealPlanEntryDto) => Boolean(value.productId))
  @IsString()
  unit?: string;

  @ValidateIf((value: AddMealPlanEntryDto) => Boolean(value.recipeId))
  @Type(() => Number)
  @IsNumber()
  servings?: number;
}
