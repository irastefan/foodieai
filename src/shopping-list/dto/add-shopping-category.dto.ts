import { IsString, MinLength } from "class-validator";

export class AddShoppingCategoryDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
