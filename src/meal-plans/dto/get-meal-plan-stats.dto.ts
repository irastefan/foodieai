import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, Matches } from "class-validator";

export class GetMealPlanStatsDto {
  @ApiPropertyOptional({
    example: "week",
    description: "Range preset: week = last 7 days, month = last 30 days, custom = explicit fromDate/toDate.",
  })
  @IsOptional()
  @IsIn(["week", "month", "custom"])
  period?: "week" | "month" | "custom";

  @ApiPropertyOptional({
    example: "2026-04-18",
    description: "Anchor date in YYYY-MM-DD used for week/month presets. Defaults to today.",
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @ApiPropertyOptional({
    example: "2026-04-01",
    description: "Start date in YYYY-MM-DD. Required for custom period.",
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate?: string;

  @ApiPropertyOptional({
    example: "2026-04-18",
    description: "End date in YYYY-MM-DD. Required for custom period.",
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate?: string;
}
