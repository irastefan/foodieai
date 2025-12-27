import { Body, Controller, Get, Headers, Post, Put } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthContextService } from "../auth/auth-context.service";
import { UpsertUserProfileDto } from "./dto/upsert-user-profile.dto";
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
  async getMe(@Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = await this.authContext.getOrCreateUserId(headers);
    return this.usersService.getUserWithProfile(userId);
  }

  // Create or update the current user's profile.
  @Put("profile")
  @ApiOperation({
    summary: "Upsert profile",
    description: "Creates or updates profile and recalculates targets if possible.",
  })
  async upsertProfile(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: UpsertUserProfileDto,
  ) {
    const userId = await this.authContext.getOrCreateUserId(headers);
    return this.usersService.upsertProfile(userId, body);
  }

  // Recalculate targets from the current profile.
  @Post("profile/recalculate")
  @ApiOperation({
    summary: "Recalculate targets",
    description: "Recalculates targets if required fields are present.",
  })
  async recalculateTargets(
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const userId = await this.authContext.getOrCreateUserId(headers);
    return this.usersService.recalculateTargets(userId);
  }
}
