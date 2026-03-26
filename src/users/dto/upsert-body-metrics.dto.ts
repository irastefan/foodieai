import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsOptional, Matches, Min } from "class-validator";

export class UpsertBodyMetricsDto {
  @ApiPropertyOptional({ example: "2026-03-26" })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @ApiPropertyOptional({ example: 62.4 })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  weightKg?: number;

  @ApiPropertyOptional({ example: 72 })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  neckCm?: number;

  @ApiPropertyOptional({ example: 89 })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  bustCm?: number;

  @ApiPropertyOptional({ example: 76 })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  underbustCm?: number;

  @ApiPropertyOptional({ example: 68 })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  waistCm?: number;

  @ApiPropertyOptional({ example: 95 })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  hipsCm?: number;

  @ApiPropertyOptional({ example: 28 })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  bicepsCm?: number;

  @ApiPropertyOptional({ example: 24 })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  forearmCm?: number;

  @ApiPropertyOptional({ example: 54 })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  thighCm?: number;

  @ApiPropertyOptional({ example: 35 })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  calfCm?: number;
}
