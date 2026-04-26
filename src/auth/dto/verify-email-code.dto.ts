import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, Length } from "class-validator";

export class VerifyEmailCodeDto {
  @ApiProperty({ example: "ira@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "123456", description: "6-digit one-time code sent to email" })
  @IsString()
  @Length(6, 6)
  code!: string;
}
