import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { CreateRecipeDto } from "./dto/create-recipe.dto";
import { UpdateRecipeDto } from "./dto/update-recipe.dto";

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRecipeDto) {
    if (dto.ingredients.length === 0) {
      throw new BadRequestException("ingredients must not be empty");
    }

    const productIds = [...new Set(dto.ingredients.map((ingredient) => ingredient.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        kcal100: true,
        protein100: true,
        fat100: true,
        carbs100: true,
      },
    });
    const productById = new Map(products.map((product) => [product.id, product]));

    const missingProductIds = productIds.filter((id) => !productById.has(id));
    if (missingProductIds.length > 0) {
      throw new NotFoundException({
        code: "PRODUCT_NOT_FOUND",
        message: "Some products were not found",
        productIds: missingProductIds,
      });
    }

    const nutrition = this.calculateNutritionTotals(
      dto.ingredients.map((ingredient) => {
        const product = productById.get(ingredient.productId)!;
        return {
          amount: ingredient.amount,
          unit: ingredient.unit,
          kcal100: product.kcal100,
          protein100: product.protein100,
          fat100: product.fat100,
          carbs100: product.carbs100,
        };
      }),
      dto.servings,
    );

    return this.prisma.recipe.create({
      data: {
        title: dto.title,
        category: dto.category ?? null,
        description: dto.description ?? null,
        servings: dto.servings ?? null,
        nutritionTotal: nutrition.total as any,
        nutritionPerServing: nutrition.perServing as any,
        ingredients: {
          createMany: {
            data: dto.ingredients.map((ingredient, index) => {
              const product = productById.get(ingredient.productId)!;
              return {
                order: index + 1,
                name: ingredient.name?.trim() || product.name,
                amount: ingredient.amount,
                unit: ingredient.unit,
                productId: ingredient.productId,
                kcal100: product.kcal100,
                protein100: product.protein100,
                fat100: product.fat100,
                carbs100: product.carbs100,
              };
            }),
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

  async search(query?: string | null, category?: string | null, limit?: number | null) {
    const take = limit && limit > 0 ? Math.min(limit, 50) : 20;
    const where: Record<string, unknown> = {};

    if (category) {
      where.category = category;
    }

    if (query) {
      where.OR = [
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
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
        updatedAt: true,
      },
    });
  }

  async get(recipeId: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
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

  async update(recipeId: string, dto: UpdateRecipeDto) {
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

    const ingredientsInput = dto.ingredients ?? null;
    if (ingredientsInput && ingredientsInput.length === 0) {
      throw new BadRequestException("ingredients must not be empty");
    }

    let ingredientRows: Array<{
      order: number;
      name: string;
      amount: number | null;
      unit: string | null;
      productId: string | null;
      kcal100: number | null;
      protein100: number | null;
      fat100: number | null;
      carbs100: number | null;
    }> = [];

    if (ingredientsInput) {
      const productIds = [...new Set(ingredientsInput.map((ingredient) => ingredient.productId))];
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          kcal100: true,
          protein100: true,
          fat100: true,
          carbs100: true,
        },
      });
      const productById = new Map(products.map((product) => [product.id, product]));
      const missingProductIds = productIds.filter((id) => !productById.has(id));
      if (missingProductIds.length > 0) {
        throw new NotFoundException({
          code: "PRODUCT_NOT_FOUND",
          message: "Some products were not found",
          productIds: missingProductIds,
        });
      }

      ingredientRows = ingredientsInput.map((ingredient, index) => {
        const product = productById.get(ingredient.productId)!;
        return {
          order: index + 1,
          name: ingredient.name?.trim() || product.name,
          amount: ingredient.amount,
          unit: ingredient.unit,
          productId: ingredient.productId,
          kcal100: product.kcal100,
          protein100: product.protein100,
          fat100: product.fat100,
          carbs100: product.carbs100,
        };
      });
    } else {
      ingredientRows = existing.ingredients.map((ingredient) => ({
        order: ingredient.order ?? 1,
        name: ingredient.name,
        amount: ingredient.amount,
        unit: ingredient.unit,
        productId: ingredient.productId,
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

    return this.get(recipeId);
  }

  async remove(recipeId: string) {
    const existing = await this.prisma.recipe.findUnique({ where: { id: recipeId }, select: { id: true } });
    if (!existing) {
      throw new NotFoundException({
        code: "RECIPE_NOT_FOUND",
        message: "Recipe not found",
        recipeId,
      });
    }
    await this.prisma.recipe.delete({ where: { id: recipeId } });
    return { deleted: true, recipeId };
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
