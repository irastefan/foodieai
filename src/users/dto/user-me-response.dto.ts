import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserProfileResponseDto } from "./user-profile-response.dto";

export class UserMeResponseDto {
  @ApiProperty({ example: "user_123" })
  id!: string;

  @ApiProperty({ example: "dev-user" })
  externalId!: string;

  @ApiPropertyOptional({ type: UserProfileResponseDto, nullable: true })
  profile!: UserProfileResponseDto | null;
}
