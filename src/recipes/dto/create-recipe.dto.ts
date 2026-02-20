import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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

class CreateRecipeIngredientDto {
  @ApiProperty({ example: "prod_egg" })
  @IsString()
  productId!: string;

  @ApiPropertyOptional({ example: "Egg" })
  @IsOptional()
  @IsString()
  name?: string | null;

  @ApiProperty({ example: 120 })
  @IsNumber()
  amount!: number;

  @ApiProperty({ example: "g" })
  @IsString()
  unit!: string;
}

export class CreateRecipeDto {
  @ApiProperty({ example: "Omelette" })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: "breakfast" })
  @IsOptional()
  @IsString()
  category?: string | null;

  @ApiPropertyOptional({ example: "Quick omelette" })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  servings?: number | null;

  @ApiPropertyOptional({
    example: false,
    description: "If true, recipe is visible to all users",
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiProperty({ type: [CreateRecipeIngredientDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRecipeIngredientDto)
  ingredients!: CreateRecipeIngredientDto[];

  @ApiProperty({ example: ["Beat eggs", "Cook on pan", "Serve"] })
  @IsArray()
  @IsString({ each: true })
  steps!: string[];
}
