import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

class UpdateRecipeIngredientDto {
  @ApiPropertyOptional({ example: "prod_egg" })
  @IsString()
  productId!: string;

  @ApiPropertyOptional({ example: "Egg" })
  @IsOptional()
  @IsString()
  name?: string | null;

  @ApiPropertyOptional({ example: 120 })
  @IsNumber()
  amount!: number;

  @ApiPropertyOptional({ example: "g" })
  @IsString()
  unit!: string;
}

export class UpdateRecipeDto {
  @ApiPropertyOptional({ example: "Omelette with herbs" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: "breakfast" })
  @IsOptional()
  @IsString()
  category?: string | null;

  @ApiPropertyOptional({ example: "Updated description" })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  servings?: number | null;

  @ApiPropertyOptional({
    example: true,
    description: "If true, recipe is visible to all users",
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ type: [UpdateRecipeIngredientDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateRecipeIngredientDto)
  ingredients?: UpdateRecipeIngredientDto[];

  @ApiPropertyOptional({ example: ["Beat eggs", "Cook", "Serve"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  steps?: string[];
}
