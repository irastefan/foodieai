import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, Matches } from "class-validator";

export class GetMealPlanHistoryDto {
  @ApiPropertyOptional({
    example: "2026-02-20",
    description: "Anchor date in YYYY-MM-DD. Returns unique items added in the previous 30 days up to this date.",
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @ApiPropertyOptional({
    example: "2026-01-20",
    description: "Start date in YYYY-MM-DD. If omitted, the API uses the previous 30 days up to date/today.",
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate?: string;

  @ApiPropertyOptional({
    example: "2026-02-20",
    description: "End date in YYYY-MM-DD. If omitted, the API uses date/today.",
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate?: string;

  @ApiPropertyOptional({
    example: "protein bar",
    description: "Case-insensitive substring search by meal item name.",
  })
  @IsOptional()
  query?: string;
}
