import { IsInt, IsOptional, IsString } from "class-validator";

export class SearchRecipesDto {
  @IsOptional()
  @IsString()
  query?: string | null;

  @IsOptional()
  @IsString()
  category?: string | null;

  @IsOptional()
  @IsInt()
  limit?: number | null;
}
