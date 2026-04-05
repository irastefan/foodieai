import { Body, Controller, Delete, Get, Headers, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AuthContextService } from "../auth/auth-context.service";
import { AddMealPlanEntryDto } from "./dto/add-meal-plan-entry.dto";
import { CopyMealPlanSlotDto } from "./dto/copy-meal-plan-slot.dto";
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
    description: "Returns unique meal plan items for the selected date range, with optional substring search by item name. Defaults to the last 30 days up to the selected date/today.",
  })
  @ApiQuery({ name: "date", required: false, example: "2026-02-20" })
  @ApiQuery({ name: "fromDate", required: false, example: "2026-01-22" })
  @ApiQuery({ name: "toDate", required: false, example: "2026-02-20" })
  @ApiQuery({ name: "query", required: false, example: "protein bar" })
  @ApiOkResponse({
    description: "Meal plan add history",
    schema: {
      type: "object",
      example: {
        anchorDate: "2026-03-01",
        fromDate: "2026-02-01",
        toDate: "2026-03-01",
        query: "protein bar",
        items: [
          {
            entryId: "mpe_123",
            dayId: "mpd_123",
            date: "2026-02-28",
            createdAt: "2026-02-28T09:15:00.000Z",
            slot: "SNACK",
            type: "PRODUCT",
            name: "Protein bar chocolate",
            isManual: false,
            product: { id: "prod_123", name: "Protein bar chocolate" },
            recipe: null,
            amount: 1,
            unit: "pcs",
            servings: null,
            nutritionPer100: {
              kcal100: 380,
              protein100: 28,
              fat100: 12,
              carbs100: 36,
            },
            nutritionTotal: {
              calories: 190,
              protein: 14,
              fat: 6,
              carbs: 18,
            },
          },
        ],
      },
      properties: {
        anchorDate: { type: "string", example: "2026-02-20" },
        fromDate: { type: "string", example: "2026-01-22" },
        toDate: { type: "string", example: "2026-02-20" },
        query: { type: ["string", "null"], example: "protein bar" },
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
              product: {
                type: ["object", "null"],
                properties: {
                  id: { type: "string", example: "prod_123" },
                  name: { type: "string", example: "Greek yogurt" },
                },
              },
              recipe: {
                type: ["object", "null"],
                properties: {
                  id: { type: "string", example: "rec_123" },
                  title: { type: "string", example: "Protein pancakes" },
                },
              },
              amount: { type: ["number", "null"], example: 150 },
              unit: { type: ["string", "null"], example: "g" },
              servings: { type: ["number", "null"], example: null },
              nutritionPer100: {
                type: ["object", "null"],
                properties: {
                  kcal100: { type: "number", example: 63 },
                  protein100: { type: "number", example: 5.2 },
                  fat100: { type: "number", example: 3.1 },
                  carbs100: { type: "number", example: 7.4 },
                },
              },
              nutritionTotal: {
                type: "object",
                properties: {
                  calories: { type: "number", example: 95 },
                  protein: { type: "number", example: 7.8 },
                  fat: { type: "number", example: 4.65 },
                  carbs: { type: "number", example: 11.1 },
                },
              },
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
    return this.mealPlansService.getHistory(userId, query);
  }

  @Post("day/copy-slot")
  @ApiOperation({
    summary: "Copy meal slot from another day",
    description: "Copies all entries from one meal slot on a source day into a target day slot, preserving their order.",
  })
  @ApiBody({
    type: CopyMealPlanSlotDto,
    examples: {
      sameSlot: {
        summary: "Copy breakfast to another day",
        value: {
          sourceDate: "2026-02-20",
          sourceSlot: "BREAKFAST",
          targetDate: "2026-02-21",
        },
      },
      differentSlot: {
        summary: "Copy dinner into lunch",
        value: {
          sourceDate: "2026-02-20",
          sourceSlot: "DINNER",
          targetDate: "2026-02-21",
          targetSlot: "LUNCH",
        },
      },
    },
  })
  @ApiOkResponse({
    description: "Updated target day meal plan after copy",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "mpd_123" },
        date: { type: "string", example: "2026-02-21" },
        slots: { type: "object" },
        nutritionBySlot: { type: "object" },
        nutritionTotal: { type: "object" },
      },
    },
  })
  async copySlot(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() dto: CopyMealPlanSlotDto,
  ) {
    const userId = await this.authContext.getUserId(headers);
    return this.mealPlansService.copySlot(userId, dto);
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
