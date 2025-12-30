import { Injectable } from "@nestjs/common";
import { Prisma, Recipe, RecipeDraft, RecipeDraftIngredient, RecipeDraftStep } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { DraftIncompleteError, RecipeDraftNotFoundError } from "./recipes.errors";

const SNAPSHOT_WARNING =
  "⚠️ Некоторые ингредиенты содержат оценочные данные (snapshot).";

type DraftWithRelations = RecipeDraft & {
  ingredients: RecipeDraftIngredient[];
  steps: RecipeDraftStep[];
};

type DraftValidationResult = {
  isValid: boolean;
  missingFields: string[];
  missingIngredients: Array<{
    ingredientId: string;
    name: string;
    missing: string[];
    hint: string;
  }>;
};

@Injectable()
export class RecipeDraftsService {
  constructor(private readonly prisma: PrismaService) {}

  async createDraft(dto: {
    title: string;
    category?: string | null;
    description?: string | null;
    servings?: number | null;
  }) {
    return this.prisma.recipeDraft.create({
      data: {
        title: dto.title,
        category: dto.category ?? null,
        description: dto.description ?? null,
        servings: dto.servings ?? null,
      },
      include: {
        ingredients: { orderBy: { order: "asc" } },
        steps: { orderBy: { order: "asc" } },
      },
    });
  }

  async addIngredient(
    draftId: string,
    ingredient: {
      originalText?: string | null;
      name: string;
      amount?: number | null;
      unit?: string | null;
      productId?: string | null;
      order?: number | null;
      assumptions?: Prisma.JsonValue | null;
      macrosPer100?: {
        kcal100: number;
        protein100: number;
        fat100: number;
        carbs100: number;
      } | null;
      clientRequestId?: string | null;
    },
    clientRequestId?: string | null,
  ) {
    const key = clientRequestId ?? ingredient.clientRequestId ?? null;

    const { result } = await this.prisma.$transaction(async (prisma) => {
      const tx = prisma as Prisma.TransactionClient & { idempotencyKey?: any };
      if (key && tx.idempotencyKey) {
        const existingKey = await tx.idempotencyKey.findUnique({
          where: {
            operation_key_entityId: {
              operation: "recipeDraft.addIngredient",
              key,
              entityId: draftId,
            },
          },
        });
        if (existingKey?.result) {
          return { result: existingKey.result as DraftWithRelations, replay: true };
        }
      }

      const draft = await prisma.recipeDraft.findUnique({
        where: { id: draftId },
      });
      if (!draft) {
        throw new RecipeDraftNotFoundError();
      }

      const order = ingredient.order ?? (await this.nextIngredientOrderTx(prisma, draftId));

      const existingByOrder = await prisma.recipeDraftIngredient.findFirst({
        where: { draftId, order },
      });

      if (existingByOrder) {
        await prisma.recipeDraftIngredient.update({
          where: { id: existingByOrder.id },
          data: {
            originalText: ingredient.originalText ?? null,
            name: ingredient.name,
            amount: ingredient.amount ?? null,
            unit: ingredient.unit ?? null,
            productId: ingredient.productId ?? null,
            kcal100: ingredient.macrosPer100?.kcal100 ?? null,
            protein100: ingredient.macrosPer100?.protein100 ?? null,
            fat100: ingredient.macrosPer100?.fat100 ?? null,
            carbs100: ingredient.macrosPer100?.carbs100 ?? null,
            assumptions: this.toNullableJson(ingredient.assumptions),
          },
        });
      } else {
        await prisma.recipeDraftIngredient.create({
          data: {
            draftId,
            order,
            originalText: ingredient.originalText ?? null,
            name: ingredient.name,
            amount: ingredient.amount ?? null,
            unit: ingredient.unit ?? null,
            productId: ingredient.productId ?? null,
            kcal100: ingredient.macrosPer100?.kcal100 ?? null,
            protein100: ingredient.macrosPer100?.protein100 ?? null,
            fat100: ingredient.macrosPer100?.fat100 ?? null,
            carbs100: ingredient.macrosPer100?.carbs100 ?? null,
            assumptions: this.toNullableJson(ingredient.assumptions),
          },
        });
      }

      const draftWithRelations = (await prisma.recipeDraft.findUnique({
        where: { id: draftId },
        include: {
          ingredients: { orderBy: { order: "asc" } },
          steps: { orderBy: { order: "asc" } },
        },
      })) as DraftWithRelations;

      if (key && tx.idempotencyKey) {
        await tx.idempotencyKey.create({
          data: {
            operation: "recipeDraft.addIngredient",
            key,
            entityId: draftId,
            result: draftWithRelations,
          },
        });
      }

      return { result: draftWithRelations };
    });

    return result;
  }

  async removeIngredient(draftId: string, ingredientId: string, clientRequestId?: string | null) {
    const key = clientRequestId ?? null;

    const { result } = await this.prisma.$transaction(async (prisma) => {
      const tx = prisma as Prisma.TransactionClient & { idempotencyKey?: any };
      if (key && tx.idempotencyKey) {
        const existingKey = await tx.idempotencyKey.findUnique({
          where: {
            operation_key_entityId: {
              operation: "recipeDraft.removeIngredient",
              key,
              entityId: draftId,
            },
          },
        });
        if (existingKey?.result) {
          return { result: existingKey.result as RecipeDraftIngredient[] };
        }
      }

      const draft = await prisma.recipeDraft.findUnique({
        where: { id: draftId },
      });
      if (!draft) {
        throw new RecipeDraftNotFoundError();
      }

      const deletion = await prisma.recipeDraftIngredient.deleteMany({
        where: { id: ingredientId, draftId },
      });

      if (deletion.count === 0) {
        throw new RecipeDraftNotFoundError();
      }

      const ingredients = await prisma.recipeDraftIngredient.findMany({
        where: { draftId },
        orderBy: { order: "asc" },
      });

      if (key && tx.idempotencyKey) {
        await tx.idempotencyKey.create({
          data: {
            operation: "recipeDraft.removeIngredient",
            key,
            entityId: draftId,
            result: ingredients,
          },
        });
      }

      return { result: ingredients };
    });

    return result;
  }

  async setSteps(draftId: string, steps: string[], clientRequestId?: string | null) {
    const key = clientRequestId ?? null;

    const { result } = await this.prisma.$transaction(async (prisma) => {
      const tx = prisma as Prisma.TransactionClient & { idempotencyKey?: any };
      if (key && tx.idempotencyKey) {
        const existingKey = await tx.idempotencyKey.findUnique({
          where: {
            operation_key_entityId: {
              operation: "recipeDraft.setSteps",
              key,
              entityId: draftId,
            },
          },
        });
        if (existingKey?.result) {
          return { result: existingKey.result as RecipeDraftStep[] };
        }
      }

      const draft = await prisma.recipeDraft.findUnique({
        where: { id: draftId },
      });
      if (!draft) {
        throw new RecipeDraftNotFoundError();
      }

      await prisma.recipeDraftStep.deleteMany({ where: { draftId } });
      if (steps.length > 0) {
        await prisma.recipeDraftStep.createMany({
          data: steps.map((text, index) => ({
            draftId,
            order: index + 1,
            text,
          })),
        });
      }

      const resultSteps = await prisma.recipeDraftStep.findMany({
        where: { draftId },
        orderBy: { order: "asc" },
      });

      if (key && tx.idempotencyKey) {
        await tx.idempotencyKey.create({
          data: {
            operation: "recipeDraft.setSteps",
            key,
            entityId: draftId,
            result: resultSteps,
          },
        });
      }

      return { result: resultSteps };
    });

    return result;
  }

  async getDraft(draftId: string): Promise<DraftWithRelations> {
    const draft = await this.prisma.recipeDraft.findUnique({
      where: { id: draftId },
      include: {
        ingredients: { orderBy: { order: "asc" } },
        steps: { orderBy: { order: "asc" } },
      },
    });

    if (!draft) {
      throw new RecipeDraftNotFoundError();
    }

    return draft;
  }

  async validateDraft(draftId: string): Promise<DraftValidationResult> {
    const draft = await this.getDraft(draftId);
    return this.evaluateDraft(draft);
  }

  async publishDraft(draftId: string, clientRequestId?: string | null) {
    const key = clientRequestId ?? null;

    const idempotencyClient = this.prisma as any;
    const existingFromKey = key && idempotencyClient.idempotencyKey
      ? await idempotencyClient.idempotencyKey.findUnique({
          where: {
            operation_key_entityId: {
              operation: "recipeDraft.publish",
              key,
              entityId: draftId,
            },
          },
        })
      : null;
    if (existingFromKey?.result) {
      return existingFromKey.result as Recipe;
    }

    const draft = await this.getDraft(draftId);
    const validation = this.evaluateDraft(draft);

    if (!validation.isValid) {
      throw new DraftIncompleteError({
        missingFields: validation.missingFields,
        missingIngredients: validation.missingIngredients,
      });
    }

    const hasSnapshotIngredient = draft.ingredients.some(
      (ingredient) => !ingredient.productId,
    );
    const description = this.buildPublishedDescription(
      draft.description ?? null,
      hasSnapshotIngredient,
    );

    const recipe = await this.prisma.$transaction(async (prisma) => {
      const recipe = await prisma.recipe.create({
        data: {
          title: draft.title,
          category: draft.category,
          description,
          servings: draft.servings,
          ingredients: {
            createMany: {
              data: draft.ingredients.map((ingredient) => ({
                order: ingredient.order,
                originalText: ingredient.originalText,
                name: ingredient.name,
                amount: ingredient.amount,
                unit: ingredient.unit,
                productId: ingredient.productId,
                kcal100: ingredient.kcal100,
                protein100: ingredient.protein100,
                fat100: ingredient.fat100,
                carbs100: ingredient.carbs100,
                assumptions: this.toNullableJson(ingredient.assumptions),
              })),
            },
          },
          steps: {
            createMany: {
              data: draft.steps.map((step) => ({
                order: step.order,
                text: step.text,
              })),
            },
          },
        },
        include: {
          ingredients: { orderBy: { order: "asc" } },
          steps: { orderBy: { order: "asc" } },
        },
      });

      await prisma.recipeDraft.update({
        where: { id: draftId },
        data: { status: "PUBLISHED" },
      });

      return recipe;
    });

    if (key && idempotencyClient.idempotencyKey) {
      await idempotencyClient.idempotencyKey.create({
        data: {
          operation: "recipeDraft.publish",
          key,
          entityId: draftId,
          result: recipe,
        },
      });
    }

    return recipe;
  }

  private toNullableJson(
    value: Prisma.JsonValue | null | undefined,
  ): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return Prisma.JsonNull;
    }
    return value as Prisma.InputJsonValue;
  }

  private async nextIngredientOrder(draftId: string) {
    const aggregation = await this.prisma.recipeDraftIngredient.aggregate({
      where: { draftId },
      _max: { order: true },
    });
    return (aggregation._max.order ?? 0) + 1;
  }

  private async nextIngredientOrderTx(prisma: Prisma.TransactionClient, draftId: string) {
    const aggregation = await prisma.recipeDraftIngredient.aggregate({
      where: { draftId },
      _max: { order: true },
    });
    return (aggregation._max.order ?? 0) + 1;
  }

  private evaluateDraft(draft: DraftWithRelations): DraftValidationResult {
    const missingFields: string[] = [];
    const missingIngredients: DraftValidationResult["missingIngredients"] = [];

    if (!draft.title || draft.title.trim().length === 0) {
      missingFields.push("title");
    }

    if (draft.ingredients.length === 0) {
      missingFields.push("ingredients");
    }

    if (draft.steps.length === 0) {
      missingFields.push("steps");
    }

    for (const ingredient of draft.ingredients) {
      if (ingredient.productId) {
        continue;
      }

      const hasMacros =
        ingredient.kcal100 != null &&
        ingredient.protein100 != null &&
        ingredient.fat100 != null &&
        ingredient.carbs100 != null;

      if (!hasMacros) {
        missingIngredients.push({
          ingredientId: ingredient.id,
          name: ingredient.name,
          missing: ["productId", "macrosPer100"],
          hint: "Specify productId or provide macrosPer100",
        });
      }
    }

    return {
      isValid: missingFields.length === 0 && missingIngredients.length === 0,
      missingFields,
      missingIngredients,
    };
  }

  private buildPublishedDescription(
    description: string | null,
    hasSnapshotIngredient: boolean,
  ) {
    if (!hasSnapshotIngredient) {
      return description;
    }

    if (!description || description.trim().length === 0) {
      return SNAPSHOT_WARNING;
    }

    return `${description}\n\n${SNAPSHOT_WARNING}`;
  }
}
