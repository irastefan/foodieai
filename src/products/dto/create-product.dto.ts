import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateProductDto {
  @ApiProperty({ example: "Greek Yogurt" })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: "Acme" })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiProperty({ example: 120 })
  @IsInt()
  @Min(0)
  kcal100!: number;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0)
  protein100!: number;

  @ApiProperty({ example: 3.5 })
  @IsNumber()
  @Min(0)
  fat100!: number;

  @ApiProperty({ example: 8 })
  @IsNumber()
  @Min(0)
  carbs100!: number;
}
