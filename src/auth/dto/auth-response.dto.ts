import { ApiProperty } from "@nestjs/swagger";

class AuthUserDto {
  @ApiProperty({ example: "user_123" })
  id!: string;

  @ApiProperty({ example: "ira@example.com" })
  email!: string;
}

export class AuthResponseDto {
  @ApiProperty({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." })
  accessToken!: string;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}
