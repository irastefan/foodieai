import { Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { AddRecipeDraftIngredientDto } from "./dto/add-recipe-draft-ingredient.dto";
import { CreateRecipeDraftDto } from "./dto/create-recipe-draft.dto";
import { DraftIdDto } from "./dto/draft-id.dto";
import { RemoveRecipeDraftIngredientDto } from "./dto/remove-recipe-draft-ingredient.dto";
import { SetRecipeDraftStepsDto } from "./dto/set-recipe-draft-steps.dto";
import { RecipeDraftsService } from "./recipe-drafts.service";

@ApiTags("recipe-drafts")
@Controller("v1/recipe-drafts")
export class RecipeDraftsController {
  // REST endpoints for recipe draft workflow.
  constructor(private readonly recipeDraftsService: RecipeDraftsService) {}

  @Post()
  @ApiOperation({
    summary: "Create draft",
    description:
      "Creates a new recipe draft. If sourceRecipeId is provided, clones the published recipe (ingredients/steps) into the draft. clientRequestId enables idempotent create.",
  })
  @ApiBody({
    type: CreateRecipeDraftDto,
    examples: {
      simple: {
        summary: "Minimal draft",
        value: { title: "Omelette", category: "breakfast" },
      },
      clone: {
        summary: "Clone from recipe",
        value: {
          title: "Tiramisu v2",
          category: "dessert",
          servings: 4,
          sourceRecipeId: "rec_123",
          clientRequestId: "req-create-1",
        },
      },
    },
  })
  async create(@Body() dto: CreateRecipeDraftDto) {
    return this.recipeDraftsService.createDraft(dto);
  }

  @Post("ingredients")
  @ApiOperation({
    summary: "Add ingredient",
    description: "Adds an ingredient to a draft (order auto-assigned if omitted).",
  })
  @ApiBody({
    type: AddRecipeDraftIngredientDto,
    examples: {
      snapshot: {
        summary: "Snapshot ingredient",
        value: {
          draftId: "draft_123",
          ingredient: {
            name: "Tomato",
            amount: 120,
            unit: "g",
            macrosPer100: {
              kcal100: 18,
              protein100: 0.9,
              fat100: 0.2,
              carbs100: 3.9,
            },
            assumptions: { source: "estimation" },
          },
        },
      },
      linked: {
        summary: "Linked to product",
        value: {
          draftId: "draft_123",
          ingredient: {
            name: "Olive oil",
            amount: 10,
            unit: "g",
            productId: "prod_456",
          },
        },
      },
    },
  })
  async addIngredient(@Body() dto: AddRecipeDraftIngredientDto) {
    return this.recipeDraftsService.addIngredient(
      dto.draftId,
      dto.ingredient,
      dto.ingredient.clientRequestId,
    );
  }

  @Delete("ingredients")
  @ApiOperation({
    summary: "Remove ingredient",
    description: "Removes an ingredient from a draft.",
  })
  @ApiBody({
    type: RemoveRecipeDraftIngredientDto,
    examples: {
      remove: {
        summary: "Remove ingredient",
        value: { draftId: "draft_123", ingredientId: "ing_789" },
      },
    },
  })
  async removeIngredient(@Body() dto: RemoveRecipeDraftIngredientDto) {
    return this.recipeDraftsService.removeIngredient(
      dto.draftId,
      dto.ingredientId,
      dto.clientRequestId,
    );
  }

  @Put("steps")
  @ApiOperation({
    summary: "Set steps",
    description: "Replaces all steps for a draft.",
  })
  @ApiBody({
    type: SetRecipeDraftStepsDto,
    examples: {
      replace: {
        summary: "Replace steps",
        value: {
          draftId: "draft_123",
          steps: ["Beat eggs", "Cook in pan", "Serve warm"],
        },
      },
    },
  })
  async setSteps(@Body() dto: SetRecipeDraftStepsDto) {
    return this.recipeDraftsService.setSteps(
      dto.draftId,
      dto.steps,
      dto.clientRequestId,
    );
  }

  @Get(":draftId")
  @ApiOperation({
    summary: "Get draft",
    description: "Returns a draft with ingredients and steps.",
  })
  @ApiParam({ name: "draftId", example: "draft_123" })
  async getDraft(@Param() params: DraftIdDto) {
    return this.recipeDraftsService.getDraft(params.draftId);
  }

  @Post(":draftId/validate")
  @ApiOperation({
    summary: "Validate draft",
    description: "Validates draft and returns validation result without throwing.",
  })
  @ApiParam({ name: "draftId", example: "draft_123" })
  async validateDraft(@Param() params: DraftIdDto) {
    return this.recipeDraftsService.validateDraft(params.draftId);
  }

  @Post(":draftId/recalculate")
  @ApiOperation({
    summary: "Recalculate draft nutrition",
    description: "Recalculates nutrition totals/perServing server-side for the draft.",
  })
  @ApiParam({ name: "draftId", example: "draft_123" })
  async recalc(@Param() params: DraftIdDto) {
    return this.recipeDraftsService.recalcDraft(params.draftId);
  }

  @Post(":draftId/publish")
  @ApiOperation({
    summary: "Publish draft",
    description: "Publishes draft into a recipe (throws if incomplete).",
  })
  @ApiParam({ name: "draftId", example: "draft_123" })
  @ApiBody({
    schema: {
      type: "object",
      properties: { clientRequestId: { type: "string", nullable: true } },
    },
    examples: {
      publish: {
        summary: "Publish with idempotency key",
        value: { clientRequestId: "req-publish-1" },
      },
    },
  })
  async publishDraft(@Param() params: DraftIdDto) {
    return this.recipeDraftsService.publishDraft(params.draftId);
  }
}
