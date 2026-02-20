import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class RemoveMealPlanEntryDto {
  @ApiProperty({ example: "entry_123" })
  @IsString()
  entryId!: string;
}
