import { Body, Controller, Get, Headers, Post, Put } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthContextService } from "../auth/auth-context.service";
import { EmptyBodyDto } from "./dto/empty-body.dto";
import { UpsertUserProfileDto } from "./dto/upsert-user-profile.dto";
import { UserMeResponseDto } from "./dto/user-me-response.dto";
import { UserProfileResponseDto } from "./dto/user-profile-response.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@Controller("v1")
export class UsersController {
  // REST endpoints for current user and profile.
  constructor(
    private readonly usersService: UsersService,
    private readonly authContext: AuthContextService,
  ) {}

  // Return current user and profile based on Bearer token.
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
    const userId = await this.resolveUserId(headers);
    return this.usersService.getUserWithProfile(userId);
  }

  // Create or update the current user's profile.
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
    const userId = await this.resolveUserId(headers);
    return this.usersService.upsertProfile(userId, body);
  }

  // Recalculate targets from the current profile.
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
    const userId = await this.resolveUserId(headers);
    return this.usersService.recalculateTargets(userId);
  }

  private async resolveUserId(
    headers: Record<string, string | string[] | undefined>,
  ) {
    const authHeader = headers["authorization"];
    const value = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    if (value && value.startsWith("Bearer ")) {
      return this.authContext.getOrCreateUserId(headers);
    }
    const devSub = process.env.DEV_AUTH_BYPASS_SUB || "dev-user";
    const user = await this.usersService.getOrCreateByExternalId(devSub);
    return user.id;
  }
}
