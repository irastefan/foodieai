import { Body, Controller, Get, Headers, Param, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { AuthContextService } from "../auth/auth-context.service";
import { EmptyBodyDto } from "./dto/empty-body.dto";
import { UpsertUserProfileDto } from "./dto/upsert-user-profile.dto";
import { UserIdDto } from "./dto/user-id.dto";
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

  @Get("me/products")
  @ApiOperation({
    summary: "Get my products",
    description: "Returns all products created by current authenticated user.",
  })
  @ApiOkResponse({
    description: "Current user products",
    schema: {
      type: "array",
      items: { type: "object" },
    },
  })
  async getMyProducts(@Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = await this.authContext.getUserId(headers);
    return this.usersService.getProductsByUser(userId, userId);
  }

  @Get("me/recipes")
  @ApiOperation({
    summary: "Get my recipes",
    description: "Returns all recipes created by current authenticated user.",
  })
  @ApiOkResponse({
    description: "Current user recipes",
    schema: {
      type: "array",
      items: { type: "object" },
    },
  })
  async getMyRecipes(@Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = await this.authContext.getUserId(headers);
    return this.usersService.getRecipesByUser(userId, userId);
  }

  @Get("users/:userId/products")
  @ApiOperation({
    summary: "Get products by user",
    description:
      "Returns products created by user. Public products are visible to everyone, private only to owner.",
  })
  @ApiParam({ name: "userId", example: "cmlv9swq00000nsn1xpqwmhsz" })
  @ApiOkResponse({
    description: "Products of user",
    schema: {
      type: "array",
      items: { type: "object" },
    },
  })
  async getProductsByUser(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param() params: UserIdDto,
  ) {
    const viewerUserId = await this.authContext.getOptionalUserId(headers);
    return this.usersService.getProductsByUser(params.userId, viewerUserId);
  }

  @Get("users/:userId/recipes")
  @ApiOperation({
    summary: "Get recipes by user",
    description:
      "Returns recipes created by user. Public recipes are visible to everyone, private only to owner.",
  })
  @ApiParam({ name: "userId", example: "cmlv9swq00000nsn1xpqwmhsz" })
  @ApiOkResponse({
    description: "Recipes of user",
    schema: {
      type: "array",
      items: { type: "object" },
    },
  })
  async getRecipesByUser(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param() params: UserIdDto,
  ) {
    const viewerUserId = await this.authContext.getOptionalUserId(headers);
    return this.usersService.getRecipesByUser(params.userId, viewerUserId);
  }
}
