import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { AddMealPlanEntryDto } from "./dto/add-meal-plan-entry.dto";

type NutritionTotals = {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

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
            productId: product.id,
            amount: dto.amount,
            unit: dto.unit,
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
            recipeId: recipe.id,
            servings,
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

  private parseSlot(slot: string): MealSlotName {
    const normalized = slot.trim().toUpperCase();
    if (!SLOT_ORDER.includes(normalized as MealSlotName)) {
      throw new BadRequestException("slot must be BREAKFAST, LUNCH, DINNER or SNACK");
    }
    return normalized as MealSlotName;
  }

  private resolveMode(dto: AddMealPlanEntryDto): "product" | "recipe" {
    const hasProduct = Boolean(dto.productId);
    const hasRecipe = Boolean(dto.recipeId);
    if (hasProduct === hasRecipe) {
      throw new BadRequestException("Provide exactly one of productId or recipeId");
    }
    if (hasProduct) {
      if (dto.amount == null || !dto.unit) {
        throw new BadRequestException("For product, amount and unit are required");
      }
      return "product";
    }
    return "recipe";
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
        product: entry.product,
        recipe: entry.recipe,
        amount: entry.amount,
        unit: entry.unit,
        servings: entry.servings,
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
}
