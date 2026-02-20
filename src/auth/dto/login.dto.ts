import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "ira@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "StrongPass123" })
  @IsString()
  @MinLength(8)
  password!: string;
}
