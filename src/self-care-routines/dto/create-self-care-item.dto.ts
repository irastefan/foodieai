import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class CreateSelfCareItemDto {
  @ApiProperty({ example: "Vitamin C serum" })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: "Apply after cleansing, before moisturizer" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: "Skip if skin feels irritated" })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: 2, description: "1-based item order inside the slot" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  order?: number;
}
