import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, Matches, Max, Min, ValidateIf } from "class-validator";

export class GetBodyMetricsHistoryDto {
  @ApiPropertyOptional({ example: "2026-03-01" })
  @ValidateIf((_, value) => value !== undefined)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate?: string;

  @ApiPropertyOptional({ example: "2026-03-26" })
  @ValidateIf((_, value) => value !== undefined)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate?: string;

  @ApiPropertyOptional({ example: 30, description: "Used only when fromDate is not provided." })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  limitDays?: number;
}
