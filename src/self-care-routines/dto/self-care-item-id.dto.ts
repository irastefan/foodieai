import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class SelfCareItemIdDto {
  @ApiProperty({ example: "item_123" })
  @IsString()
  itemId!: string;
}
