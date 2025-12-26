import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class SearchProductsDto {
  @ApiPropertyOptional({ example: "yogurt" })
  @IsOptional()
  @IsString()
  query?: string;
}
