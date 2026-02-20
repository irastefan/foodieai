import { Body, Controller, Get, Headers, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthContextService } from "../auth/auth-context.service";
import { EmptyBodyDto } from "./dto/empty-body.dto";
import { UpsertUserProfileDto } from "./dto/upsert-user-profile.dto";
import { UserMeResponseDto } from "./dto/user-me-response.dto";
import { UserProfileResponseDto } from "./dto/user-profile-response.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth("bearer")
@Controller("v1")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authContext: AuthContextService,
  ) {}

  @Get("me")
  @ApiOperation({
    summary: "Get current user",
    description: "Returns the authenticated user and profile from Bearer token.",
  })
  @ApiOkResponse({
    description: "Current user with profile",
    type: UserMeResponseDto,
  })
  async getMe(@Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = await this.authContext.getUserId(headers);
    return this.usersService.getUserWithProfile(userId);
  }

  @Put("profile")
  @ApiOperation({
    summary: "Upsert profile",
    description: "Creates or updates profile and recalculates targets if possible.",
  })
  @ApiBody({
    type: UpsertUserProfileDto,
    examples: {
      fullProfile: {
        summary: "Full profile",
        value: {
          firstName: "Ira",
          lastName: "Stefan",
          sex: "FEMALE",
          birthDate: "1994-05-10",
          heightCm: 168,
          weightKg: 63,
          activityLevel: "MODERATE",
          goal: "LOSE",
          calorieDelta: -400,
        },
      },
    },
  })
  @ApiOkResponse({
    description: "Saved profile",
    type: UserProfileResponseDto,
  })
  async upsertProfile(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: UpsertUserProfileDto,
  ) {
    const userId = await this.authContext.getUserId(headers);
    return this.usersService.upsertProfile(userId, body);
  }

  @Post("profile/recalculate")
  @ApiOperation({
    summary: "Recalculate targets",
    description: "Recalculates targets if required fields are present.",
  })
  @ApiBody({
    type: EmptyBodyDto,
    examples: {
      empty: {
        summary: "No payload",
        value: {},
      },
    },
  })
  @ApiOkResponse({
    description: "Profile with recalculated targets",
    type: UserProfileResponseDto,
  })
  async recalculateTargets(
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const userId = await this.authContext.getUserId(headers);
    return this.usersService.recalculateTargets(userId);
  }
}
