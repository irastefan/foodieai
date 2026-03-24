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
}
