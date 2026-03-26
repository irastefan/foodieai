import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, Matches } from "class-validator";

export class GetBodyMetricsDayDto {
  @ApiPropertyOptional({ example: "2026-03-26" })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}
