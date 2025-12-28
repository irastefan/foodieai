import { IsString } from "class-validator";

export class RecipeIdDto {
  @IsString()
  recipeId!: string;
}
