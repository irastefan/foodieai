import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class ShoppingCategoryIdDto {
  @ApiProperty({ example: "cat_123" })
  @IsString()
  categoryId!: string;
}
