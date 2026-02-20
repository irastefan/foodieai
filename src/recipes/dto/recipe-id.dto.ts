import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class RecipeIdDto {
  @ApiProperty({ example: "rec_123" })
  @IsString()
  recipeId!: string;
}
