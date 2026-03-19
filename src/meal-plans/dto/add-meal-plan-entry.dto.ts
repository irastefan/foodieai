import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, Matches } from "class-validator";

export class AddMealPlanEntryDto {
  @ApiPropertyOptional({ example: "2026-02-20" })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @ApiProperty({ enum: ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] })
  @IsString()
  slot!: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";

  @ApiPropertyOptional({ example: "prod_123" })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ example: "rec_123" })
  @IsOptional()
  @IsString()
  recipeId?: string;

  @ApiPropertyOptional({ example: "Homemade yogurt" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 150 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional({ example: "g" })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  servings?: number;

  @ApiPropertyOptional({ example: 63 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  kcal100?: number;

  @ApiPropertyOptional({ example: 5.2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  protein100?: number;

  @ApiPropertyOptional({ example: 3.1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fat100?: number;

  @ApiPropertyOptional({ example: 7.4 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  carbs100?: number;
}
