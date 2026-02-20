import { IsString } from "class-validator";

export class ShoppingItemIdDto {
  @IsString()
  itemId!: string;
}
