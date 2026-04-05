import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches } from "class-validator";

export class CopyMealPlanSlotDto {
  @ApiProperty({ example: "2026-02-20" })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  sourceDate!: string;

  @ApiProperty({ enum: ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] })
  @IsString()
  sourceSlot!: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";

  @ApiProperty({ example: "2026-02-21" })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  targetDate!: string;

  @ApiPropertyOptional({
    enum: ["BREAKFAST", "LUNCH", "DINNER", "SNACK"],
    description: "If omitted, copies into the same slot name as sourceSlot.",
  })
  @IsOptional()
  @IsString()
  targetSlot?: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
}
