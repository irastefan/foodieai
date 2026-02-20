import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString } from "class-validator";

export class SearchRecipesDto {
  @ApiPropertyOptional({ example: "omelette" })
  @IsOptional()
  @IsString()
  query?: string | null;

  @ApiPropertyOptional({ example: "breakfast" })
  @IsOptional()
  @IsString()
  category?: string | null;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  limit?: number | null;
}
