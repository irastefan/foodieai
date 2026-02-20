import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, Matches, ValidateIf } from "class-validator";

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

  @ApiPropertyOptional({ example: 150 })
  @ValidateIf((value: AddMealPlanEntryDto) => Boolean(value.productId))
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional({ example: "g" })
  @ValidateIf((value: AddMealPlanEntryDto) => Boolean(value.productId))
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: 1 })
  @ValidateIf((value: AddMealPlanEntryDto) => Boolean(value.recipeId))
  @Type(() => Number)
  @IsNumber()
  servings?: number;
}
