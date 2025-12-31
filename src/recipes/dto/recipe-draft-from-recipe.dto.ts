import { IsString } from "class-validator";

export class RecipeDraftFromRecipeDto {
  @IsString()
  recipeId!: string;
}
