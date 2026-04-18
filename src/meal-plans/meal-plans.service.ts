import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { AddMealPlanEntryDto } from "./dto/add-meal-plan-entry.dto";
import { CopyMealPlanSlotDto } from "./dto/copy-meal-plan-slot.dto";
import { GetMealPlanHistoryDto } from "./dto/get-meal-plan-history.dto";
import { GetMealPlanStatsDto } from "./dto/get-meal-plan-stats.dto";

type NutritionTotals = {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

type NutritionPer100 = {
  kcal100: number;
  protein100: number;
  fat100: number;
  carbs100: number;
};

type MealPlanHistoryItem = {
  entryId: string;
  dayId: string;
  date: string;
  createdAt: string;
  slot: MealSlotName;
  type: string;
  name: string | null;
  isManual: boolean;
  product: { id: string; name: string } | null;
  recipe: { id: string; title: string } | null;
  amount: number | null;
  unit: string | null;
  servings: number | null;
  nutritionPer100: NutritionPer100 | null;
  nutritionTotal: NutritionTotals;
};

type NutritionGoals = {
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
};

type MealPlanStatsPeriod = "week" | "month" | "custom";

const SLOT_ORDER = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const;
type MealSlotName = (typeof SLOT_ORDER)[number];

@Injectable()
export class MealPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async getDay(userId: string, date?: string) {
    const dayDate = this.parseDay(date);
    const day = await this.getOrCreateDay(userId, dayDate);
    const hydrated = await this.recalculateDay(day.id);
    return this.formatDay(hydrated);
  }

  async addEntry(userId: string, dto: AddMealPlanEntryDto) {
    const dayDate = this.parseDay(dto.date);
    const slot = this.parseSlot(dto.slot);
    const mode = this.resolveMode(dto);

    const dayId = await this.prisma.$transaction(async (tx) => {
      const day = await (tx as any).mealPlanDay.upsert({
        where: {
          ownerUserId_date: {
            ownerUserId: userId,
            date: dayDate,
          },
        },
        update: {},
        create: {
          ownerUserId: userId,
          date: dayDate,
        },
      });

      const nextOrder = await this.nextOrderInSlotTx(tx as any, day.id, slot);

      if (mode === "product") {
        const product = await tx.product.findFirst({
          where: {
            id: dto.productId as string,
            OR: [{ scope: "GLOBAL" }, { ownerUserId: userId }],
          },
          select: {
            id: true,
            name: true,
            kcal100: true,
            protein100: true,
            fat100: true,
            carbs100: true,
          },
        });
        if (!product) {
          throw new NotFoundException({
            code: "PRODUCT_NOT_FOUND",
            message: "Product not found",
            productId: dto.productId,
          });
        }

        const nutrition = this.calculateFromProduct(
          dto.amount as number,
          dto.unit as string,
          product,
        );

        await (tx as any).mealPlanEntry.create({
          data: {
            dayId: day.id,
            slot,
            entryType: "PRODUCT",
            order: nextOrder,
            customName: product.name,
            productId: product.id,
            isManual: false,
            amount: dto.amount,
            unit: dto.unit,
            nutritionPer100: {
              kcal100: product.kcal100,
              protein100: product.protein100,
              fat100: product.fat100,
              carbs100: product.carbs100,
            } as unknown as Prisma.InputJsonValue,
            nutritionTotal: nutrition as unknown as Prisma.InputJsonValue,
          },
        });
      }

      if (mode === "recipe") {
        const recipe = await tx.recipe.findFirst({
          where: {
            id: dto.recipeId as string,
            OR: [{ visibility: "PUBLIC" }, { ownerUserId: userId }],
          },
          select: {
            id: true,
            title: true,
            nutritionPerServing: true,
          },
        });
        if (!recipe) {
          throw new NotFoundException({
            code: "RECIPE_NOT_FOUND",
            message: "Recipe not found",
            recipeId: dto.recipeId,
          });
        }

        const base = this.parseNutrition(recipe.nutritionPerServing);
        if (!base) {
          throw new BadRequestException("recipe has no nutritionPerServing");
        }
        const servings = dto.servings && dto.servings > 0 ? dto.servings : 1;
        const nutrition: NutritionTotals = {
          calories: base.calories * servings,
          protein: base.protein * servings,
          fat: base.fat * servings,
          carbs: base.carbs * servings,
        };

        await (tx as any).mealPlanEntry.create({
          data: {
            dayId: day.id,
            slot,
            entryType: "RECIPE",
            order: nextOrder,
            customName: recipe.title,
            recipeId: recipe.id,
            isManual: false,
            servings,
            nutritionTotal: nutrition as unknown as Prisma.InputJsonValue,
          },
        });
      }

      if (mode === "manual") {
        const nutritionPer100 = this.getManualNutritionPer100(dto);
        const nutrition = this.calculateFromProduct(
          dto.amount as number,
          dto.unit as string,
          nutritionPer100,
        );

        await (tx as any).mealPlanEntry.create({
          data: {
            dayId: day.id,
            slot,
            entryType: "PRODUCT",
            order: nextOrder,
            customName: dto.name?.trim(),
            isManual: true,
            amount: dto.amount,
            unit: dto.unit,
            nutritionPer100: nutritionPer100 as unknown as Prisma.InputJsonValue,
            nutritionTotal: nutrition as unknown as Prisma.InputJsonValue,
          },
        });
      }

      return day.id;
    });

    const recalculated = await this.recalculateDay(dayId);
    return this.formatDay(recalculated);
  }

  async removeEntry(userId: string, entryId: string) {
    const entry = await (this.prisma as any).mealPlanEntry.findFirst({
      where: {
        id: entryId,
        day: { ownerUserId: userId },
      },
      select: {
        id: true,
        dayId: true,
      },
    });

    if (!entry) {
      throw new NotFoundException({
        code: "MEAL_PLAN_ENTRY_NOT_FOUND",
        message: "Meal plan entry not found",
        entryId,
      });
    }

    await (this.prisma as any).mealPlanEntry.delete({ where: { id: entry.id } });
    const recalculated = await this.recalculateDay(entry.dayId);
    return this.formatDay(recalculated);
  }

  async getHistory(userId: string, dto: GetMealPlanHistoryDto = {}) {
    const range = this.resolveHistoryRange(dto);
    const query = this.normalizeQuery(dto.query);
    const entries = await (this.prisma as any).mealPlanEntry.findMany({
      where: {
        day: {
          ownerUserId: userId,
          date: {
            gte: range.from,
            lte: range.to,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        day: { select: { id: true, date: true } },
        product: { select: { id: true, name: true } },
        recipe: { select: { id: true, title: true } },
      },
    });

    const seen = new Set<string>();
    const items: MealPlanHistoryItem[] = [];

    for (const entry of entries) {
      if (query && !this.historyEntryMatchesQuery(entry, query)) {
        continue;
      }
      const key = this.buildHistoryDedupKey(entry);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      items.push(this.formatHistoryItem(entry));
    }

    return {
      anchorDate: range.anchor.toISOString().slice(0, 10),
      fromDate: range.from.toISOString().slice(0, 10),
      toDate: range.to.toISOString().slice(0, 10),
      query,
      items,
    };
  }

  async getStats(userId: string, dto: GetMealPlanStatsDto = {}) {
    const range = this.resolveStatsRange(dto);
    const [days, profile] = await Promise.all([
      (this.prisma as any).mealPlanDay.findMany({
        where: {
          ownerUserId: userId,
          date: {
            gte: range.from,
            lte: range.to,
          },
        },
        orderBy: { date: "asc" },
        select: {
          date: true,
          nutritionTotal: true,
        },
      }),
      (this.prisma as any).userProfile.findUnique({
        where: { userId },
        select: {
          targetCalories: true,
          targetProteinG: true,
          targetFatG: true,
          targetCarbsG: true,
        },
      }),
    ]);

    const dailyByKey = new Map<string, NutritionTotals>();
    for (const day of days) {
      const key = day.date.toISOString().slice(0, 10);
      dailyByKey.set(key, this.parseNutrition(day.nutritionTotal) ?? this.emptyTotals());
    }

    const goals = this.formatNutritionGoals(profile);
    const points: Array<{
      date: string;
      nutritionTotal: NutritionTotals;
      goal: NutritionGoals;
      hasEntries: boolean;
    }> = [];
    const totals = this.emptyTotals();

    for (const current of this.listDatesInRange(range.from, range.to)) {
      const key = current.toISOString().slice(0, 10);
      const nutrition = dailyByKey.get(key) ?? this.emptyTotals();
      totals.calories += nutrition.calories;
      totals.protein += nutrition.protein;
      totals.fat += nutrition.fat;
      totals.carbs += nutrition.carbs;
      points.push({
        date: key,
        nutritionTotal: nutrition,
        goal: goals,
        hasEntries: dailyByKey.has(key),
      });
    }

    const dayCount = points.length || 1;
    return {
      period: range.period,
      anchorDate: range.anchor.toISOString().slice(0, 10),
      fromDate: range.from.toISOString().slice(0, 10),
      toDate: range.to.toISOString().slice(0, 10),
      daysCount: points.length,
      goals,
      totals,
      averages: {
        calories: totals.calories / dayCount,
        protein: totals.protein / dayCount,
        fat: totals.fat / dayCount,
        carbs: totals.carbs / dayCount,
      },
      goalTotals: {
        calories: goals.calories == null ? null : goals.calories * points.length,
        protein: goals.protein == null ? null : goals.protein * points.length,
        fat: goals.fat == null ? null : goals.fat * points.length,
        carbs: goals.carbs == null ? null : goals.carbs * points.length,
      },
      points,
    };
  }

  async copySlot(userId: string, dto: CopyMealPlanSlotDto) {
    const sourceDate = this.parseDay(dto.sourceDate);
    const sourceSlot = this.parseSlot(dto.sourceSlot);
    const targetDate = this.parseDay(dto.targetDate);
    const targetSlot = this.parseSlot(dto.targetSlot ?? dto.sourceSlot);

    const targetDayId = await this.prisma.$transaction(async (tx) => {
      const sourceDay = await (tx as any).mealPlanDay.findUnique({
        where: {
          ownerUserId_date: {
            ownerUserId: userId,
            date: sourceDate,
          },
        },
        include: {
          entries: {
            where: { slot: sourceSlot },
            orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          },
        },
      });

      if (!sourceDay) {
        throw new NotFoundException({
          code: "MEAL_PLAN_DAY_NOT_FOUND",
          message: "Source meal plan day not found",
          sourceDate: dto.sourceDate,
        });
      }

      if (sourceDay.entries.length === 0) {
        throw new NotFoundException({
          code: "MEAL_PLAN_SLOT_EMPTY",
          message: "Source meal slot has no entries to copy",
          sourceDate: dto.sourceDate,
          sourceSlot,
        });
      }

      const targetDay = await (tx as any).mealPlanDay.upsert({
        where: {
          ownerUserId_date: {
            ownerUserId: userId,
            date: targetDate,
          },
        },
        update: {},
        create: {
          ownerUserId: userId,
          date: targetDate,
        },
      });

      let nextOrder = await this.nextOrderInSlotTx(tx as any, targetDay.id, targetSlot);
      for (const entry of sourceDay.entries) {
        await (tx as any).mealPlanEntry.create({
          data: {
            dayId: targetDay.id,
            slot: targetSlot,
            entryType: entry.entryType,
            order: nextOrder,
            customName: entry.customName,
            productId: entry.productId,
            recipeId: entry.recipeId,
            isManual: entry.isManual,
            amount: entry.amount,
            unit: entry.unit,
            servings: entry.servings,
            nutritionPer100: entry.nutritionPer100 as Prisma.InputJsonValue | undefined,
            nutritionTotal: entry.nutritionTotal as Prisma.InputJsonValue | undefined,
          },
        });
        nextOrder += 1;
      }

      return targetDay.id;
    });

    const recalculated = await this.recalculateDay(targetDayId);
    return this.formatDay(recalculated);
  }

  private async getOrCreateDay(userId: string, date: Date) {
    return (this.prisma as any).mealPlanDay.upsert({
      where: {
        ownerUserId_date: {
          ownerUserId: userId,
          date,
        },
      },
      update: {},
      create: {
        ownerUserId: userId,
        date,
      },
    });
  }

  private async nextOrderInSlotTx(
    tx: any,
    dayId: string,
    slot: MealSlotName,
  ) {
    const aggregation = await tx.mealPlanEntry.aggregate({
      where: { dayId, slot },
      _max: { order: true },
    });
    return (aggregation._max.order ?? 0) + 1;
  }

  private parseDay(date?: string) {
    const value = date && date.trim().length > 0
      ? date
      : new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException("date must be YYYY-MM-DD");
    }
    const [year, month, day] = value.split("-").map((part) => Number(part));
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new BadRequestException("invalid date");
    }
    return parsed;
  }

  private getHistoryRange(anchorDate: Date) {
    const from = new Date(anchorDate);
    from.setUTCDate(from.getUTCDate() - 29);
    const to = new Date(anchorDate);
    to.setUTCHours(23, 59, 59, 999);
    return { from, to };
  }

  private resolveHistoryRange(dto: GetMealPlanHistoryDto) {
    if (dto.fromDate || dto.toDate) {
      const anchor = this.parseDay(dto.toDate ?? dto.date);
      const from = this.parseDay(dto.fromDate ?? dto.toDate ?? dto.date);
      const to = this.endOfDay(dto.toDate ? this.parseDay(dto.toDate) : anchor);
      if (from.getTime() > to.getTime()) {
        throw new BadRequestException("fromDate must be before or equal to toDate");
      }
      return { anchor, from, to };
    }

    const anchor = this.parseDay(dto.date);
    const range = this.getHistoryRange(anchor);
    return { anchor, from: range.from, to: range.to };
  }

  private parseSlot(slot: string): MealSlotName {
    const normalized = slot.trim().toUpperCase();
    if (!SLOT_ORDER.includes(normalized as MealSlotName)) {
      throw new BadRequestException("slot must be BREAKFAST, LUNCH, DINNER or SNACK");
    }
    return normalized as MealSlotName;
  }

  private endOfDay(date: Date) {
    const value = new Date(date);
    value.setUTCHours(23, 59, 59, 999);
    return value;
  }

  private startOfDay(date: Date) {
    const value = new Date(date);
    value.setUTCHours(0, 0, 0, 0);
    return value;
  }

  private addDays(date: Date, days: number) {
    const value = new Date(date);
    value.setUTCDate(value.getUTCDate() + days);
    return value;
  }

  private listDatesInRange(from: Date, to: Date) {
    const result: Date[] = [];
    let current = this.startOfDay(from);
    const end = this.startOfDay(to);
    while (current.getTime() <= end.getTime()) {
      result.push(current);
      current = this.addDays(current, 1);
    }
    return result;
  }

  private resolveStatsRange(dto: GetMealPlanStatsDto) {
    const period = dto.period ?? "week";
    if (period === "custom") {
      if (!dto.fromDate || !dto.toDate) {
        throw new BadRequestException("fromDate and toDate are required for custom period");
      }
      const from = this.parseDay(dto.fromDate);
      const toDay = this.parseDay(dto.toDate);
      const to = this.endOfDay(toDay);
      if (from.getTime() > to.getTime()) {
        throw new BadRequestException("fromDate must be before or equal to toDate");
      }
      return {
        period,
        anchor: toDay,
        from,
        to,
      };
    }

    const anchor = this.parseDay(dto.date);
    const lengthDays = period === "month" ? 30 : 7;
    const from = this.addDays(anchor, -(lengthDays - 1));
    return {
      period,
      anchor,
      from,
      to: this.endOfDay(anchor),
    };
  }

  private normalizeQuery(query?: string) {
    if (typeof query !== "string") {
      return null;
    }
    const value = query.trim().toLowerCase();
    return value.length > 0 ? value : null;
  }

  private resolveMode(dto: AddMealPlanEntryDto): "product" | "recipe" | "manual" {
    const hasProduct = Boolean(dto.productId);
    const hasRecipe = Boolean(dto.recipeId);
    if (hasProduct && hasRecipe) {
      throw new BadRequestException("Provide only one of productId or recipeId");
    }
    if (hasProduct) {
      if (dto.amount == null || !dto.unit) {
        throw new BadRequestException("For product, amount and unit are required");
      }
      return "product";
    }
    if (hasRecipe) {
      return "recipe";
    }
    if (!dto.name?.trim()) {
      throw new BadRequestException("For manual entry, name is required");
    }
    if (dto.amount == null || !dto.unit) {
      throw new BadRequestException("For manual entry, amount and unit are required");
    }
    this.getManualNutritionPer100(dto);
    return "manual";
  }

  private calculateFromProduct(
    amount: number,
    unit: string,
    product: { kcal100: number; protein100: number; fat100: number; carbs100: number },
  ): NutritionTotals {
    const unitToGram: Record<string, number> = {
      g: 1,
      gram: 1,
      grams: 1,
      kg: 1000,
      ml: 1,
      l: 1000,
    };
    const factor = unitToGram[unit.toLowerCase()];
    if (!factor) {
      throw new BadRequestException("Unsupported unit for product entry");
    }
    const grams = amount * factor;
    return {
      calories: (grams * product.kcal100) / 100,
      protein: (grams * product.protein100) / 100,
      fat: (grams * product.fat100) / 100,
      carbs: (grams * product.carbs100) / 100,
    };
  }

  private getManualNutritionPer100(dto: AddMealPlanEntryDto): NutritionPer100 {
    const nutrition = {
      kcal100: dto.kcal100,
      protein100: dto.protein100,
      fat100: dto.fat100,
      carbs100: dto.carbs100,
    };
    if (Object.values(nutrition).some((value) => value == null)) {
      throw new BadRequestException(
        "For manual entry, kcal100, protein100, fat100 and carbs100 are required",
      );
    }
    return nutrition as NutritionPer100;
  }

  private parseNutritionPer100(value: unknown): NutritionPer100 | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const source = value as Record<string, unknown>;
    const kcal100 = Number(source.kcal100);
    const protein100 = Number(source.protein100);
    const fat100 = Number(source.fat100);
    const carbs100 = Number(source.carbs100);
    if ([kcal100, protein100, fat100, carbs100].some((item) => Number.isNaN(item))) {
      return null;
    }
    return { kcal100, protein100, fat100, carbs100 };
  }

  private parseNutrition(value: unknown): NutritionTotals | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const source = value as Record<string, unknown>;
    const calories = Number(source.calories);
    const protein = Number(source.protein);
    const fat = Number(source.fat);
    const carbs = Number(source.carbs);
    if ([calories, protein, fat, carbs].some((item) => Number.isNaN(item))) {
      return null;
    }
    return { calories, protein, fat, carbs };
  }

  private formatNutritionGoals(profile: {
    targetCalories?: number | null;
    targetProteinG?: number | null;
    targetFatG?: number | null;
    targetCarbsG?: number | null;
  } | null): NutritionGoals {
    return {
      calories: profile?.targetCalories ?? null,
      protein: profile?.targetProteinG ?? null,
      fat: profile?.targetFatG ?? null,
      carbs: profile?.targetCarbsG ?? null,
    };
  }

  private async recalculateDay(dayId: string) {
    const day = await (this.prisma as any).mealPlanDay.findUnique({
      where: { id: dayId },
      include: {
        entries: {
          orderBy: [{ slot: "asc" }, { order: "asc" }],
          include: {
            product: { select: { id: true, name: true } },
            recipe: { select: { id: true, title: true } },
          },
        },
      },
    });

    if (!day) {
      throw new NotFoundException({
        code: "MEAL_PLAN_DAY_NOT_FOUND",
        message: "Meal plan day not found",
        dayId,
      });
    }

    const bySlot = this.emptyBySlotTotals();
    const total = this.emptyTotals();

    for (const entry of day.entries) {
      const slot = this.parseSlot(String(entry.slot));
      const nutrition = this.parseNutrition(entry.nutritionTotal) ?? this.emptyTotals();
      bySlot[slot].calories += nutrition.calories;
      bySlot[slot].protein += nutrition.protein;
      bySlot[slot].fat += nutrition.fat;
      bySlot[slot].carbs += nutrition.carbs;

      total.calories += nutrition.calories;
      total.protein += nutrition.protein;
      total.fat += nutrition.fat;
      total.carbs += nutrition.carbs;
    }

    await (this.prisma as any).mealPlanDay.update({
      where: { id: day.id },
      data: {
        nutritionBySlot: bySlot as unknown as Prisma.InputJsonValue,
        nutritionTotal: total as unknown as Prisma.InputJsonValue,
      },
    });

    return (this.prisma as any).mealPlanDay.findUniqueOrThrow({
      where: { id: day.id },
      include: {
        entries: {
          orderBy: [{ slot: "asc" }, { order: "asc" }],
          include: {
            product: { select: { id: true, name: true } },
            recipe: { select: { id: true, title: true } },
          },
        },
      },
    });
  }

  private emptyTotals(): NutritionTotals {
    return { calories: 0, protein: 0, fat: 0, carbs: 0 };
  }

  private emptyBySlotTotals(): Record<MealSlotName, NutritionTotals> {
    return {
      BREAKFAST: this.emptyTotals(),
      LUNCH: this.emptyTotals(),
      DINNER: this.emptyTotals(),
      SNACK: this.emptyTotals(),
    };
  }

  private formatDay(
    day: any,
  ) {
    const grouped: Record<MealSlotName, unknown[]> = {
      BREAKFAST: [],
      LUNCH: [],
      DINNER: [],
      SNACK: [],
    };

    for (const entry of day.entries) {
      const slot = this.parseSlot(String(entry.slot));
      grouped[slot].push({
        id: entry.id,
        slot: entry.slot,
        type: entry.entryType,
        order: entry.order,
        name: entry.customName ?? entry.product?.name ?? entry.recipe?.title ?? null,
        isManual: Boolean(entry.isManual),
        product: entry.product,
        recipe: entry.recipe,
        amount: entry.amount,
        unit: entry.unit,
        servings: entry.servings,
        nutritionPer100: this.parseNutritionPer100(entry.nutritionPer100),
        nutritionTotal: this.parseNutrition(entry.nutritionTotal) ?? this.emptyTotals(),
      });
    }

    return {
      id: day.id,
      date: day.date.toISOString().slice(0, 10),
      slots: grouped,
      nutritionBySlot: day.nutritionBySlot ?? this.emptyBySlotTotals(),
      nutritionTotal: day.nutritionTotal ?? this.emptyTotals(),
    };
  }

  private formatHistoryItem(entry: any): MealPlanHistoryItem {
    const slot = this.parseSlot(String(entry.slot));
    return {
      entryId: entry.id,
      dayId: entry.day.id,
      date: entry.day.date.toISOString().slice(0, 10),
      createdAt: entry.createdAt.toISOString(),
      slot,
      type: entry.entryType,
      name: entry.customName ?? entry.product?.name ?? entry.recipe?.title ?? null,
      isManual: Boolean(entry.isManual),
      product: entry.product ?? null,
      recipe: entry.recipe ?? null,
      amount: entry.amount ?? null,
      unit: entry.unit ?? null,
      servings: entry.servings ?? null,
      nutritionPer100: this.parseNutritionPer100(entry.nutritionPer100),
      nutritionTotal: this.parseNutrition(entry.nutritionTotal) ?? this.emptyTotals(),
    };
  }

  private historyEntryMatchesQuery(entry: any, query: string) {
    const name = this.getEntryDisplayName(entry).toLowerCase();
    return name.includes(query);
  }

  private getEntryDisplayName(entry: any) {
    return String(entry.customName ?? entry.product?.name ?? entry.recipe?.title ?? "");
  }

  private buildHistoryDedupKey(entry: any) {
    if (entry.recipeId) {
      return `recipe:${entry.recipeId}`;
    }
    if (entry.productId) {
      return `product:${entry.productId}`;
    }
    const name = typeof entry.customName === "string" ? entry.customName.trim().toLowerCase() : "";
    if (name.length > 0) {
      return `manual:${name}`;
    }
    return `entry:${entry.id}`;
  }
}
