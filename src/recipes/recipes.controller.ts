import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { RecipeIdDto } from "./dto/recipe-id.dto";
import { SearchRecipesDto } from "./dto/search-recipes.dto";
import { RecipesService } from "./recipes.service";

@ApiTags("recipes")
@Controller("v1/recipes")
export class RecipesController {
  // REST endpoints for published recipes (search and detail).
  constructor(private readonly recipesService: RecipesService) {}

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
}
