import { IsInt, IsOptional, IsString } from "class-validator";

export class CreateRecipeDraftDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  category?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsInt()
  servings?: number | null;
}
