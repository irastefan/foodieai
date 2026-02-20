import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CreateRecipeDto } from "./dto/create-recipe.dto";
import { RecipeIdDto } from "./dto/recipe-id.dto";
import { SearchRecipesDto } from "./dto/search-recipes.dto";
import { UpdateRecipeDto } from "./dto/update-recipe.dto";
import { RecipesService } from "./recipes.service";

@ApiTags("recipes")
@Controller("v1/recipes")
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Post()
  @ApiOperation({
    summary: "Create recipe",
    description: "Creates a recipe in one request with ingredients linked to products.",
  })
  @ApiBody({
    type: CreateRecipeDto,
    examples: {
      create: {
        summary: "Create in one call",
        value: {
          title: "Omelette",
          category: "breakfast",
          servings: 2,
          ingredients: [
            { productId: "prod_egg", amount: 120, unit: "g" },
            { productId: "prod_butter", amount: 10, unit: "g" },
          ],
          steps: ["Beat eggs", "Cook on pan", "Serve"],
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: "Created recipe",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "rec_123" },
        title: { type: "string", example: "Omelette" },
        category: { type: "string", nullable: true, example: "breakfast" },
        servings: { type: "number", nullable: true, example: 2 },
        ingredients: { type: "array", items: { type: "object" } },
        steps: { type: "array", items: { type: "object" } },
      },
    },
  })
  async create(@Body() dto: CreateRecipeDto) {
    return this.recipesService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: "Search recipes",
    description: "Search by title/description and optional category.",
  })
  @ApiQuery({ name: "query", required: false, example: "omelette" })
  @ApiQuery({ name: "category", required: false, example: "breakfast" })
  @ApiQuery({ name: "limit", required: false, example: 5 })
  @ApiOkResponse({
    description: "Recipe search result",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", example: "rec_123" },
          title: { type: "string", example: "Omelette" },
          category: { type: "string", nullable: true, example: "breakfast" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
    },
  })
  async search(@Query() dto: SearchRecipesDto) {
    return this.recipesService.search(dto.query, dto.category, dto.limit);
  }

  @Get(":recipeId")
  @ApiOperation({
    summary: "Get recipe",
    description: "Returns recipe with ingredients and steps.",
  })
  @ApiParam({ name: "recipeId", example: "rec_123" })
  @ApiOkResponse({
    description: "Recipe details",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "rec_123" },
        title: { type: "string", example: "Omelette" },
        category: { type: "string", nullable: true, example: "breakfast" },
        description: { type: "string", nullable: true, example: "Quick breakfast" },
        servings: { type: "number", nullable: true, example: 2 },
        ingredients: { type: "array", items: { type: "object" } },
        steps: { type: "array", items: { type: "object" } },
        nutritionTotal: { type: "object", nullable: true },
        nutritionPerServing: { type: "object", nullable: true },
      },
    },
  })
  async get(@Param() params: RecipeIdDto) {
    return this.recipesService.get(params.recipeId);
  }

  @Patch(":recipeId")
  @ApiOperation({
    summary: "Update recipe",
    description: "Updates recipe fields. ingredients/steps are replaced only when provided.",
  })
  @ApiParam({ name: "recipeId", example: "rec_123" })
  @ApiBody({
    type: UpdateRecipeDto,
    examples: {
      patchMeta: {
        summary: "Update title and servings",
        value: { title: "Omelette v2", servings: 3 },
      },
      replaceIngredientsAndSteps: {
        summary: "Replace ingredients and steps",
        value: {
          ingredients: [
            { productId: "prod_egg", amount: 150, unit: "g" },
            { productId: "prod_butter", amount: 12, unit: "g" },
          ],
          steps: ["Beat eggs thoroughly", "Cook on medium heat", "Serve"],
        },
      },
    },
  })
  @ApiOkResponse({
    description: "Updated recipe",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "rec_123" },
        title: { type: "string", example: "Omelette v2" },
        ingredients: { type: "array", items: { type: "object" } },
        steps: { type: "array", items: { type: "object" } },
      },
    },
  })
  async update(@Param() params: RecipeIdDto, @Body() dto: UpdateRecipeDto) {
    return this.recipesService.update(params.recipeId, dto);
  }

  @Delete(":recipeId")
  @ApiOperation({
    summary: "Delete recipe",
    description: "Deletes recipe by id.",
  })
  @ApiParam({ name: "recipeId", example: "rec_123" })
  @ApiResponse({
    status: 200,
    description: "Deletion result",
    schema: {
      type: "object",
      properties: {
        deleted: { type: "boolean", example: true },
        recipeId: { type: "string", example: "rec_123" },
      },
    },
  })
  async remove(@Param() params: RecipeIdDto) {
    return this.recipesService.remove(params.recipeId);
  }
}
