import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { RecipeDraftFromRecipeDto } from "./dto/recipe-draft-from-recipe.dto";
import { RecipeIdDto } from "./dto/recipe-id.dto";
import { SearchRecipesDto } from "./dto/search-recipes.dto";
import { RecipeDraftsService } from "./recipe-drafts.service";
import { RecipesService } from "./recipes.service";

@ApiTags("recipes")
@Controller("v1/recipes")
export class RecipesController {
  // REST endpoints for published recipes (search and detail).
  constructor(
    private readonly recipesService: RecipesService,
    private readonly recipeDraftsService: RecipeDraftsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "Search recipes",
    description: "Search by title/description and optional category.",
  })
  @ApiQuery({ name: "query", required: false, example: "omelette" })
  @ApiQuery({ name: "category", required: false, example: "breakfast" })
  @ApiQuery({ name: "limit", required: false, example: 5 })
  async search(@Query() dto: SearchRecipesDto) {
    return this.recipesService.search(dto.query, dto.category, dto.limit);
  }

  @Get(":recipeId")
  @ApiOperation({
    summary: "Get recipe",
    description: "Returns recipe with ingredients and steps.",
  })
  @ApiParam({ name: "recipeId", example: "rec_123" })
  async get(@Param() params: RecipeIdDto) {
    return this.recipesService.get(params.recipeId);
  }

  @Post(":recipeId/draft")
  @ApiOperation({
    summary: "Get or create draft from recipe",
    description:
      "Returns active draft for recipeId if exists, otherwise clones the recipe (metadata, ingredients, steps) into a new draft.",
  })
  @ApiParam({ name: "recipeId", example: "rec_123" })
  async getOrCreateDraft(@Param() params: RecipeDraftFromRecipeDto) {
    return this.recipeDraftsService.getOrCreateFromRecipe(params.recipeId);
  }
}
