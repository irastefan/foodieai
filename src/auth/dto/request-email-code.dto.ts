import { ApiProperty } from "@nestjs/swagger";
import { IsEmail } from "class-validator";

export class RequestEmailCodeDto {
  @ApiProperty({ example: "ira@example.com" })
  @IsEmail()
  email!: string;
}
