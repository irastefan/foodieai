import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class ProductIdDto {
  @ApiProperty({ example: "prod_123" })
  @IsString()
  productId!: string;
}
