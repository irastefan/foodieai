import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class CreateSelfCareSlotDto {
  @ApiProperty({ enum: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] })
  @IsString()
  weekday!: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

  @ApiProperty({ example: "Morning" })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 1, description: "1-based slot order inside the selected weekday" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  order?: number;
}
