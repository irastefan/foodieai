import { Type } from "class-transformer";
import { IsArray, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";

class CreateRecipeIngredientDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  name?: string | null;

  @IsNumber()
  amount!: number;

  @IsString()
  unit!: string;
}

export class CreateRecipeDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  category?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsInt()
  servings?: number | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRecipeIngredientDto)
  ingredients!: CreateRecipeIngredientDto[];

  @IsArray()
  @IsString({ each: true })
  steps!: string[];
}
