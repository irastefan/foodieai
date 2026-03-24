import { Body, Controller, Delete, Get, Headers, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AuthContextService } from "../auth/auth-context.service";
import { AddMealPlanEntryDto } from "./dto/add-meal-plan-entry.dto";
import { GetMealPlanDayDto } from "./dto/get-meal-plan-day.dto";
import { GetMealPlanHistoryDto } from "./dto/get-meal-plan-history.dto";
import { RemoveMealPlanEntryDto } from "./dto/remove-meal-plan-entry.dto";
import { MealPlansService } from "./meal-plans.service";

@ApiTags("meal-plans")
@ApiBearerAuth("bearer")
@Controller("v1/meal-plans")
export class MealPlansController {
  constructor(
    private readonly mealPlansService: MealPlansService,
    private readonly authContext: AuthContextService,
  ) {}

  @Get("day")
  @ApiOperation({
    summary: "Get day meal plan",
    description: "Returns day meal plan with K/B/Zh/U per slot and total.",
  })
  @ApiQuery({ name: "date", required: false, example: "2026-02-20" })
  @ApiOkResponse({
    description: "Day meal plan",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "mpd_123" },
        date: { type: "string", example: "2026-02-20" },
        slots: { type: "object" },
        nutritionBySlot: { type: "object" },
        nutritionTotal: { type: "object" },
      },
    },
  })
  async getDay(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query() query: GetMealPlanDayDto,
  ) {
    const userId = await this.authContext.getUserId(headers);
    return this.mealPlansService.getDay(userId, query.date);
  }

  @Get("history")
  @ApiOperation({
    summary: "Get meal plan add history",
    description: "Returns unique meal plan items added during the last 30 days up to the selected date, sorted by added time descending.",
  })
  @ApiQuery({ name: "date", required: false, example: "2026-02-20" })
  @ApiOkResponse({
    description: "Meal plan add history",
    schema: {
      type: "object",
      properties: {
        anchorDate: { type: "string", example: "2026-02-20" },
        fromDate: { type: "string", example: "2026-01-22" },
        toDate: { type: "string", example: "2026-02-20" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              entryId: { type: "string", example: "mpe_123" },
              dayId: { type: "string", example: "mpd_123" },
              date: { type: "string", example: "2026-02-20" },
              createdAt: { type: "string", example: "2026-02-20T09:15:00.000Z" },
              slot: { type: "string", example: "BREAKFAST" },
              type: { type: "string", example: "PRODUCT" },
              name: { type: "string", example: "Greek yogurt" },
              isManual: { type: "boolean", example: false },
            },
          },
        },
      },
    },
  })
  async getHistory(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query() query: GetMealPlanHistoryDto,
  ) {
    const userId = await this.authContext.getUserId(headers);
    return this.mealPlansService.getHistory(userId, query.date);
  }

  @Post("day/entries")
  @ApiOperation({
    summary: "Add meal plan entry",
    description: "Adds product or recipe into breakfast/lunch/dinner/snack.",
  })
  @ApiBody({
    type: AddMealPlanEntryDto,
    examples: {
      product: {
        summary: "Add product",
        value: {
          date: "2026-02-20",
          slot: "BREAKFAST",
          productId: "prod_123",
          amount: 150,
          unit: "g",
        },
      },
      recipe: {
        summary: "Add recipe",
        value: {
          date: "2026-02-20",
          slot: "DINNER",
          recipeId: "rec_123",
          servings: 1,
        },
      },
      manual: {
        summary: "Add manual item",
        value: {
          date: "2026-02-20",
          slot: "SNACK",
          name: "Homemade yogurt",
          amount: 180,
          unit: "g",
          kcal100: 63,
          protein100: 5.2,
          fat100: 3.1,
          carbs100: 7.4,
        },
      },
    },
  })
  @ApiOkResponse({
    description: "Updated day meal plan after add",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "mpd_123" },
        date: { type: "string", example: "2026-02-20" },
        slots: { type: "object" },
        nutritionBySlot: { type: "object" },
        nutritionTotal: { type: "object" },
      },
    },
  })
  async addEntry(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() dto: AddMealPlanEntryDto,
  ) {
    const userId = await this.authContext.getUserId(headers);
    return this.mealPlansService.addEntry(userId, dto);
  }

  @Delete("day/entries/:entryId")
  @ApiOperation({
    summary: "Remove meal plan entry",
    description: "Removes entry from day plan and recalculates totals.",
  })
  @ApiParam({ name: "entryId", example: "entry_123" })
  @ApiOkResponse({
    description: "Updated day meal plan after remove",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "mpd_123" },
        date: { type: "string", example: "2026-02-20" },
        slots: { type: "object" },
        nutritionBySlot: { type: "object" },
        nutritionTotal: { type: "object" },
      },
    },
  })
  async removeEntry(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param() params: RemoveMealPlanEntryDto,
  ) {
    const userId = await this.authContext.getUserId(headers);
    return this.mealPlansService.removeEntry(userId, params.entryId);
  }

}
