import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { RecipeVisibility } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { CreateRecipeDto } from "./dto/create-recipe.dto";
import { UpdateRecipeDto } from "./dto/update-recipe.dto";

type ResolvedIngredientRow = {
  order: number;
  name: string;
  amount: number | null;
  unit: string | null;
  productId: string | null;
  isManual: boolean;
  kcal100: number | null;
  protein100: number | null;
  fat100: number | null;
  carbs100: number | null;
};

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerUserId: string, dto: CreateRecipeDto) {
    if (dto.ingredients.length === 0) {
      throw new BadRequestException("ingredients must not be empty");
    }
    const ingredientRows = await this.resolveIngredientRows(ownerUserId, dto.ingredients);
    const nutrition = this.calculateNutritionTotals(
      ingredientRows
        .filter((row) => row.amount != null && row.unit != null)
        .map((row) => ({
          amount: row.amount as number,
          unit: row.unit as string,
          kcal100: row.kcal100 ?? 0,
          protein100: row.protein100 ?? 0,
          fat100: row.fat100 ?? 0,
          carbs100: row.carbs100 ?? 0,
        })),
      dto.servings,
    );

    return this.prisma.recipe.create({
      data: {
        ownerUserId,
        title: dto.title,
        category: dto.category ?? null,
        description: dto.description ?? null,
        servings: dto.servings ?? null,
        visibility: dto.isPublic ? RecipeVisibility.PUBLIC : RecipeVisibility.PRIVATE,
        nutritionTotal: nutrition.total as any,
        nutritionPerServing: nutrition.perServing as any,
        ingredients: {
          createMany: {
            data: ingredientRows,
          },
        },
        steps: {
          createMany: {
            data: dto.steps.map((text, index) => ({
              order: index + 1,
              text,
            })),
          },
        },
      } as any,
      include: {
        ingredients: { orderBy: { order: "asc" } },
        steps: { orderBy: { order: "asc" } },
      },
    });
  }

  async search(userId?: string, query?: string | null, category?: string | null, limit?: number | null) {
    const take = limit && limit > 0 ? Math.min(limit, 50) : 20;
    const where: Record<string, unknown> = {
      OR: userId
        ? [{ visibility: "PUBLIC" }, { ownerUserId: userId }]
        : [{ visibility: "PUBLIC" }],
    };

    if (category) {
      where.category = category;
    }

    if (query) {
      where.AND = [
        {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        },
      ];
    }

    return this.prisma.recipe.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take,
      select: {
        id: true,
        title: true,
        category: true,
        visibility: true,
        updatedAt: true,
      },
    });
  }

  async get(recipeId: string, userId?: string) {
    const recipe = await this.prisma.recipe.findFirst({
      where: {
        id: recipeId,
        OR: userId
          ? [{ visibility: "PUBLIC" }, { ownerUserId: userId }]
          : [{ visibility: "PUBLIC" }],
      },
      include: {
        ingredients: { orderBy: { order: "asc" } },
        steps: { orderBy: { order: "asc" } },
      },
    });

    if (!recipe) {
      throw new NotFoundException({
        code: "RECIPE_NOT_FOUND",
        message: "Recipe not found",
        recipeId,
      });
    }

    return recipe;
  }

  async update(ownerUserId: string, recipeId: string, dto: UpdateRecipeDto) {
    const existing = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        ingredients: { include: { product: true }, orderBy: { order: "asc" } },
        steps: { orderBy: { order: "asc" } },
      },
    });
    if (!existing) {
      throw new NotFoundException({
        code: "RECIPE_NOT_FOUND",
        message: "Recipe not found",
        recipeId,
      });
    }
    if (existing.ownerUserId !== ownerUserId) {
      throw new ForbiddenException({
        code: "RECIPE_FORBIDDEN",
        message: "You can modify only your own recipes",
        recipeId,
      });
    }

    const ingredientsInput = dto.ingredients ?? null;
    if (ingredientsInput && ingredientsInput.length === 0) {
      throw new BadRequestException("ingredients must not be empty");
    }

    let ingredientRows: ResolvedIngredientRow[] = [];

    if (ingredientsInput) {
      ingredientRows = await this.resolveIngredientRows(ownerUserId, ingredientsInput);
    } else {
      ingredientRows = existing.ingredients.map((ingredient) => ({
        order: ingredient.order ?? 1,
        name: ingredient.name,
        amount: ingredient.amount,
        unit: ingredient.unit,
        productId: ingredient.productId,
        isManual: ingredient.isManual,
        kcal100: ingredient.kcal100 ?? ingredient.product?.kcal100 ?? null,
        protein100: ingredient.protein100 ?? ingredient.product?.protein100 ?? null,
        fat100: ingredient.fat100 ?? ingredient.product?.fat100 ?? null,
        carbs100: ingredient.carbs100 ?? ingredient.product?.carbs100 ?? null,
      }));
    }

    const nutrition = this.calculateNutritionTotals(
      ingredientRows
        .filter((row) => row.amount != null && row.unit != null)
        .map((row) => ({
          amount: row.amount as number,
          unit: row.unit as string,
          kcal100: row.kcal100 ?? 0,
          protein100: row.protein100 ?? 0,
          fat100: row.fat100 ?? 0,
          carbs100: row.carbs100 ?? 0,
        })),
      dto.servings ?? existing.servings,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.recipe.update({
        where: { id: recipeId },
        data: {
          title: dto.title ?? undefined,
          category: dto.category === undefined ? undefined : dto.category,
          description: dto.description === undefined ? undefined : dto.description,
          servings: dto.servings === undefined ? undefined : dto.servings,
          visibility: dto.isPublic === undefined
            ? undefined
            : dto.isPublic
              ? RecipeVisibility.PUBLIC
              : RecipeVisibility.PRIVATE,
          nutritionTotal: nutrition.total as any,
          nutritionPerServing: nutrition.perServing as any,
        } as any,
      });

      if (ingredientsInput) {
        await tx.recipeIngredient.deleteMany({ where: { recipeId } });
        if (ingredientRows.length > 0) {
          await tx.recipeIngredient.createMany({
            data: ingredientRows.map((ingredient) => ({
              recipeId,
              order: ingredient.order,
              name: ingredient.name,
              amount: ingredient.amount,
              unit: ingredient.unit,
              productId: ingredient.productId,
              isManual: ingredient.isManual,
              kcal100: ingredient.kcal100,
              protein100: ingredient.protein100,
              fat100: ingredient.fat100,
              carbs100: ingredient.carbs100,
            })),
          });
        }
      }

      if (dto.steps) {
        await tx.recipeStep.deleteMany({ where: { recipeId } });
        if (dto.steps.length > 0) {
          await tx.recipeStep.createMany({
            data: dto.steps.map((text, index) => ({
              recipeId,
              order: index + 1,
              text,
            })),
          });
        }
      }
    });

    return this.get(recipeId, ownerUserId);
  }

  async remove(ownerUserId: string, recipeId: string) {
    const existing = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { id: true, ownerUserId: true },
    });
    if (!existing) {
      throw new NotFoundException({
        code: "RECIPE_NOT_FOUND",
        message: "Recipe not found",
        recipeId,
      });
    }
    if (existing.ownerUserId !== ownerUserId) {
      throw new ForbiddenException({
        code: "RECIPE_FORBIDDEN",
        message: "You can delete only your own recipes",
        recipeId,
      });
    }
    await this.prisma.recipe.delete({ where: { id: recipeId } });
    return { deleted: true, recipeId };
  }

  private async resolveIngredientRows(
    ownerUserId: string,
    ingredients: Array<{
      productId?: string | null;
      name?: string | null;
      amount: number;
      unit: string;
      kcal100?: number | null;
      protein100?: number | null;
      fat100?: number | null;
      carbs100?: number | null;
    }>,
  ): Promise<ResolvedIngredientRow[]> {
    const productIds = [
      ...new Set(
        ingredients
          .map((ingredient) => ingredient.productId)
          .filter((productId): productId is string => Boolean(productId)),
      ),
    ];
    const products = productIds.length > 0
      ? await this.prisma.product.findMany({
          where: {
            id: { in: productIds },
            OR: [{ scope: "GLOBAL" }, { ownerUserId }],
          },
          select: {
            id: true,
            name: true,
            kcal100: true,
            protein100: true,
            fat100: true,
            carbs100: true,
          },
        })
      : [];
    const productById = new Map(products.map((product) => [product.id, product]));
    const missingProductIds = productIds.filter((id) => !productById.has(id));
    if (missingProductIds.length > 0) {
      throw new NotFoundException({
        code: "PRODUCT_NOT_FOUND",
        message: "Some products were not found",
        productIds: missingProductIds,
      });
    }

    return ingredients.map((ingredient, index) => {
      if (ingredient.productId) {
        const product = productById.get(ingredient.productId)!;
        return {
          order: index + 1,
          name: ingredient.name?.trim() || product.name,
          amount: ingredient.amount,
          unit: ingredient.unit,
          productId: ingredient.productId,
          isManual: false,
          kcal100: product.kcal100,
          protein100: product.protein100,
          fat100: product.fat100,
          carbs100: product.carbs100,
        };
      }

      if (!ingredient.name?.trim()) {
        throw new BadRequestException("Manual ingredient requires name");
      }

      const nutrition = this.requireManualNutrition(ingredient);
      return {
        order: index + 1,
        name: ingredient.name.trim(),
        amount: ingredient.amount,
        unit: ingredient.unit,
        productId: null,
        isManual: true,
        kcal100: nutrition.kcal100,
        protein100: nutrition.protein100,
        fat100: nutrition.fat100,
        carbs100: nutrition.carbs100,
      };
    });
  }

  private requireManualNutrition(ingredient: {
    kcal100?: number | null;
    protein100?: number | null;
    fat100?: number | null;
    carbs100?: number | null;
  }) {
    if (
      ingredient.kcal100 == null ||
      ingredient.protein100 == null ||
      ingredient.fat100 == null ||
      ingredient.carbs100 == null
    ) {
      throw new BadRequestException(
        "Manual ingredient requires kcal100, protein100, fat100 and carbs100",
      );
    }
    return {
      kcal100: ingredient.kcal100,
      protein100: ingredient.protein100,
      fat100: ingredient.fat100,
      carbs100: ingredient.carbs100,
    };
  }

  private calculateNutritionTotals(
    ingredients: Array<{
      amount: number;
      unit: string;
      kcal100: number;
      protein100: number;
      fat100: number;
      carbs100: number;
    }>,
    servings: number | null | undefined,
  ) {
    const unitToGram: Record<string, number> = {
      g: 1,
      gram: 1,
      grams: 1,
      kg: 1000,
      ml: 1,
      l: 1000,
    };

    const total = { calories: 0, protein: 0, fat: 0, carbs: 0 };
    for (const ingredient of ingredients) {
      const factor = unitToGram[ingredient.unit.toLowerCase()];
      if (!factor) {
        continue;
      }
      const grams = ingredient.amount * factor;
      total.calories += (grams * ingredient.kcal100) / 100;
      total.protein += (grams * ingredient.protein100) / 100;
      total.fat += (grams * ingredient.fat100) / 100;
      total.carbs += (grams * ingredient.carbs100) / 100;
    }

    const safeServings = servings && servings > 0 ? servings : 1;
    const perServing = {
      calories: total.calories / safeServings,
      protein: total.protein / safeServings,
      fat: total.fat / safeServings,
      carbs: total.carbs / safeServings,
    };

    return { total, perServing };
  }
}
