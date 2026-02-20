import { Type } from "class-transformer";
import { IsBoolean, IsNumber, IsOptional, IsString, MinLength } from "class-validator";

export class AddShoppingItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  customName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  categoryName?: string;
}

export class SetShoppingItemStateDto {
  @IsBoolean()
  isDone!: boolean;
}
