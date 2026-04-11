import { AiUsageResponseDto } from "../ai-access/dto/ai-usage-response.dto";
import { Body, Controller, Get, Headers, Param, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiExtraModels, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { AuthContextService } from "../auth/auth-context.service";
import { BodyMetricsEntryResponseDto } from "./dto/body-metrics-response.dto";
import { EmptyBodyDto } from "./dto/empty-body.dto";
import { GetBodyMetricsDayDto } from "./dto/get-body-metrics-day.dto";
import { GetBodyMetricsHistoryDto } from "./dto/get-body-metrics-history.dto";
import { UpsertUserProfileDto } from "./dto/upsert-user-profile.dto";
import { UpsertBodyMetricsDto } from "./dto/upsert-body-metrics.dto";
import { UserIdDto } from "./dto/user-id.dto";
import { UserMeResponseDto } from "./dto/user-me-response.dto";
import { UserProfileResponseDto } from "./dto/user-profile-response.dto";
import { UsersService } from "./users.service";

const profileExample = {
  id: "profile_123",
  userId: "user_123",
  firstName: "Ira",
  lastName: "Stefan",
  sex: "FEMALE",
  birthDate: "1994-05-10T00:00:00.000Z",
  heightCm: 168,
  weightKg: 63,
  activityLevel: "MODERATE",
  goal: "LOSE",
  macroProfile: "BALANCED",
  targetFormula: "MIFFLIN_ST_JEOR",
  calorieDelta: 200,
  targetCalories: 1914,
  targetProteinG: 126,
  targetFatG: 50,
  targetCarbsG: 240,
  availableTargetFormulas: [
    {
      value: "MIFFLIN_ST_JEOR",
      label: "Mifflin-St Jeor",
      description: "Modern default for BMR/TDEE based on sex, age, height, and weight.",
      isDefault: true,
    },
    {
      value: "HARRIS_BENEDICT_REVISED",
      label: "Harris-Benedict Revised",
      description: "Updated Harris-Benedict variant with revised coefficients.",
      isDefault: false,
    },
  ],
};

@ApiTags("users")
@ApiBearerAuth("bearer")
@ApiExtraModels(UserMeResponseDto, UserProfileResponseDto, AiUsageResponseDto)
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
    schema: {
      allOf: [
        { $ref: "#/components/schemas/UserMeResponseDto" },
      ],
      example: {
        id: "user_123",
        email: "ira@example.com",
        profile: profileExample,
      },
    },
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
          macroProfile: "BALANCED",
          targetFormula: "MIFFLIN_ST_JEOR",
          calorieDelta: 200,
        },
      },
    },
  })
  @ApiOkResponse({
    description: "Saved profile",
    schema: {
      allOf: [
        { $ref: "#/components/schemas/UserProfileResponseDto" },
      ],
      example: profileExample,
    },
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
    schema: {
      allOf: [
        { $ref: "#/components/schemas/UserProfileResponseDto" },
      ],
      example: profileExample,
    },
  })
  async recalculateTargets(
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const userId = await this.authContext.getUserId(headers);
    return this.usersService.recalculateTargets(userId);
  }

  @Get("me/ai-usage")
  @ApiOperation({
    summary: "Get AI subscription and usage state",
    description: "Returns current subscription, monthly AI quota usage, derived AI actions, and available AI features.",
  })
  @ApiOkResponse({
    description: "AI usage state",
    schema: {
      allOf: [
        { $ref: "#/components/schemas/AiUsageResponseDto" },
      ],
      example: {
        subscriptionStatus: "TRIAL",
        currentPlan: {
          id: "plan_pro",
          name: "Pro",
          code: "pro",
          monthlyTokenLimit: 500000,
          monthlyAiActions: 100,
          priceCents: 999,
          currency: "USD",
          isActive: true,
        },
        currentPeriodStart: "2026-04-10T12:00:00.000Z",
        currentPeriodEnd: "2026-05-10T12:00:00.000Z",
        tokensUsed: 25000,
        tokensLimit: 100000,
        tokensRemaining: 75000,
        aiActionsUsed: 5,
        aiActionsRemaining: 15,
        availableFeatures: [
          "RECIPE_GENERATION",
          "MEAL_ANALYSIS",
          "SMART_PRODUCT_MATCH",
          "ADVANCED_AI_TOOLS",
        ],
        trialStartedAt: "2026-04-10T12:00:00.000Z",
        trialEndsAt: "2026-04-24T12:00:00.000Z",
      },
    },
  })
  async getAiUsage(@Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = await this.authContext.getUserId(headers);
    return this.usersService.getAiUsageSummary(userId);
  }

  @Get("body-metrics/daily")
  @ApiOperation({
    summary: "Get daily body metrics",
    description: "Returns weight and body measurements for a specific day. Defaults to today.",
  })
  @ApiOkResponse({
    description: "Daily body metrics entry or null",
    schema: {
      oneOf: [
        { $ref: "#/components/schemas/BodyMetricsEntryResponseDto" },
        { type: "null" },
      ],
    },
  })
  async getBodyMetricsDay(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query() query: GetBodyMetricsDayDto,
  ) {
    const userId = await this.authContext.getUserId(headers);
    return this.usersService.getBodyMetricsDay(userId, query.date);
  }

  @Put("body-metrics/daily")
  @ApiOperation({
    summary: "Upsert daily body metrics",
    description: "Creates or updates daily weight and body measurements. Repeated calls for one day merge values.",
  })
  @ApiBody({
    type: UpsertBodyMetricsDto,
    examples: {
      weightOnly: {
        summary: "Weight only",
        value: {
          date: "2026-03-26",
          weightKg: 62.4,
        },
      },
      weightAndMeasurements: {
        summary: "Weight and measurements",
        value: {
          date: "2026-03-26",
          weightKg: 62.4,
          waistCm: 68,
          hipsCm: 95,
          thighCm: 54,
        },
      },
    },
  })
  @ApiOkResponse({
    description: "Saved daily body metrics entry",
    type: BodyMetricsEntryResponseDto,
  })
  async upsertBodyMetrics(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: UpsertBodyMetricsDto,
  ) {
    const userId = await this.authContext.getUserId(headers);
    return this.usersService.upsertBodyMetrics(userId, body);
  }

  @Get("body-metrics/history")
  @ApiOperation({
    summary: "Get body metrics history",
    description: "Returns daily body metrics history for a period, sorted by date descending.",
  })
  @ApiOkResponse({
    description: "Body metrics history",
    schema: {
      type: "object",
      properties: {
        fromDate: { type: "string", example: "2026-02-26" },
        toDate: { type: "string", example: "2026-03-26" },
        items: {
          type: "array",
          items: { $ref: "#/components/schemas/BodyMetricsEntryResponseDto" },
        },
      },
    },
  })
  async getBodyMetricsHistory(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query() query: GetBodyMetricsHistoryDto,
  ) {
    const userId = await this.authContext.getUserId(headers);
    return this.usersService.getBodyMetricsHistory(userId, query);
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
