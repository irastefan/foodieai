import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class SelfCareSlotIdDto {
  @ApiProperty({ example: "slot_123" })
  @IsString()
  slotId!: string;
}
