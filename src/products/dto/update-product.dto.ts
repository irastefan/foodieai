import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class UpdateProductDto {
  @ApiPropertyOptional({ example: "Greek Yogurt 2%" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: "Acme" })
  @IsOptional()
  @IsString()
  brand?: string | null;

  @ApiPropertyOptional({ example: 110 })
  @IsOptional()
  @IsInt()
  @Min(0)
  kcal100?: number;

  @ApiPropertyOptional({ example: 11 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  protein100?: number;

  @ApiPropertyOptional({ example: 2.8 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fat100?: number;

  @ApiPropertyOptional({ example: 7.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  carbs100?: number;

  @ApiPropertyOptional({
    example: true,
    description: "If true, product is visible to all users",
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
