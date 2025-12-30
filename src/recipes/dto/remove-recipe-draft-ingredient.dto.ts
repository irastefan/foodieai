import { IsOptional, IsString } from "class-validator";

export class RemoveRecipeDraftIngredientDto {
  @IsString()
  draftId!: string;

  @IsString()
  ingredientId!: string;

  @IsOptional()
  @IsString()
  clientRequestId?: string | null;
}
