import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { RecipeNotFoundError } from "./recipes.errors";

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

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

    const recipes = await this.prisma.recipe.findMany({
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

    return recipes;
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
      throw new RecipeNotFoundError();
    }

    return recipe;
  }
}
