import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class UserIdDto {
  @ApiProperty({ example: "cmlv9swq00000nsn1xpqwmhsz" })
  @IsString()
  userId!: string;
}
