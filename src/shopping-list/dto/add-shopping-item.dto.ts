import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsNumber, IsOptional, IsString, MinLength } from "class-validator";

export class AddShoppingItemDto {
  @ApiPropertyOptional({
    example: "prod_123",
    description: "Existing product ID from /v1/products",
  })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({
    example: "Paper towels",
    description: "Free-text item name when item is not from products catalog",
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  customName?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional({ example: "pcs" })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: "For kitchen" })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    example: "cat_123",
    description: "Existing category ID",
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    example: "Home",
    description: "Category name to create/use when categoryId is not provided",
  })
  @IsOptional()
  @IsString()
  categoryName?: string;
}

export class SetShoppingItemStateDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isDone!: boolean;
}
