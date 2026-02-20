import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserProfileResponseDto } from "./user-profile-response.dto";

export class UserMeResponseDto {
  @ApiProperty({ example: "user_123" })
  id!: string;

  @ApiProperty({ example: "ira@example.com" })
  email!: string;

  @ApiPropertyOptional({ type: UserProfileResponseDto, nullable: true })
  profile!: UserProfileResponseDto | null;
}
