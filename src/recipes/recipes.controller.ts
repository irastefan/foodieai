import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AuthContextService } from "../auth/auth-context.service";
import { CreateRecipeDto } from "./dto/create-recipe.dto";
import { RecipeIdDto } from "./dto/recipe-id.dto";
import { SearchRecipesDto } from "./dto/search-recipes.dto";
import { UpdateRecipeDto } from "./dto/update-recipe.dto";
import { RecipesService } from "./recipes.service";

@ApiTags("recipes")
@Controller("v1/recipes")
export class RecipesController {
  constructor(
    private readonly recipesService: RecipesService,
    private readonly authContext: AuthContextService,
  ) {}

  @ApiBearerAuth("bearer")
  @Post()
  @ApiOperation({
    summary: "Create recipe",
    description: "Creates a user-owned recipe with linked or manual ingredients.",
  })
  @ApiBody({
    type: CreateRecipeDto,
    examples: {
      create: {
        summary: "Create recipe",
        value: {
          title: "Omelette",
          category: "breakfast",
          servings: 2,
          isPublic: false,
          ingredients: [
            { productId: "prod_egg", amount: 120, unit: "g" },
            { productId: "prod_butter", amount: 10, unit: "g" },
          ],
          steps: ["Beat eggs", "Cook on pan", "Serve"],
        },
      },
      manualIngredient: {
        summary: "Create recipe with manual ingredient",
        value: {
          title: "Protein bowl",
          servings: 1,
          ingredients: [
            { name: "Homemade yogurt", amount: 200, unit: "g", kcal100: 63, protein100: 5.2, fat100: 3.1, carbs100: 7.4 },
          ],
          steps: ["Mix", "Serve"],
        },
      },
    },
  })
  @ApiCreatedResponse({ description: "Created recipe" })
  async create(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() dto: CreateRecipeDto,
  ) {
    const userId = await this.authContext.getUserId(headers);
    return this.recipesService.create(userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: "Search recipes",
    description: "Returns public recipes and your private recipes when Bearer token is provided.",
  })
  @ApiQuery({ name: "query", required: false, example: "omelette" })
  @ApiQuery({ name: "category", required: false, example: "breakfast" })
  @ApiQuery({ name: "limit", required: false, example: 5 })
  @ApiOkResponse({ description: "Recipe search result" })
  async search(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query() dto: SearchRecipesDto,
  ) {
    const userId = await this.authContext.getOptionalUserId(headers);
    return this.recipesService.search(userId, dto.query, dto.category, dto.limit);
  }

  @Get(":recipeId")
  @ApiOperation({
    summary: "Get recipe",
    description: "Returns recipe with ingredients and steps if public or owned by current user.",
  })
  @ApiParam({ name: "recipeId", example: "rec_123" })
  @ApiOkResponse({ description: "Recipe details" })
  async get(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param() params: RecipeIdDto,
  ) {
    const userId = await this.authContext.getOptionalUserId(headers);
    return this.recipesService.get(params.recipeId, userId);
  }

  @ApiBearerAuth("bearer")
  @Patch(":recipeId")
  @ApiOperation({
    summary: "Update recipe",
    description: "Updates recipe fields. Only owner can update.",
  })
  @ApiParam({ name: "recipeId", example: "rec_123" })
  @ApiBody({
    type: UpdateRecipeDto,
    examples: {
      patchMeta: {
        summary: "Update title and servings",
        value: { title: "Omelette v2", servings: 3, isPublic: true },
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
      replaceWithManualIngredients: {
        summary: "Replace with manual ingredients",
        value: {
          ingredients: [
            { name: "Homemade yogurt", amount: 200, unit: "g", kcal100: 63, protein100: 5.2, fat100: 3.1, carbs100: 7.4 },
          ],
        },
      },
    },
  })
  @ApiOkResponse({ description: "Updated recipe" })
  async update(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param() params: RecipeIdDto,
    @Body() dto: UpdateRecipeDto,
  ) {
    const userId = await this.authContext.getUserId(headers);
    return this.recipesService.update(userId, params.recipeId, dto);
  }

  @ApiBearerAuth("bearer")
  @Delete(":recipeId")
  @ApiOperation({
    summary: "Delete recipe",
    description: "Deletes recipe by id. Only owner can delete.",
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
  async remove(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param() params: RecipeIdDto,
  ) {
    const userId = await this.authContext.getUserId(headers);
    return this.recipesService.remove(userId, params.recipeId);
  }
}
