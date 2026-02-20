import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { AuthContextService } from "../auth/auth-context.service";
import { AddShoppingCategoryDto } from "./dto/add-shopping-category.dto";
import { AddShoppingItemDto, SetShoppingItemStateDto } from "./dto/add-shopping-item.dto";
import { ShoppingCategoryIdDto } from "./dto/category-id.dto";
import { ShoppingItemIdDto } from "./dto/item-id.dto";
import { ShoppingListService } from "./shopping-list.service";
import { UpdateShoppingCategoryDto } from "./dto/update-shopping-category.dto";

@ApiTags("shopping-list")
@Controller("v1/shopping-list")
export class ShoppingListController {
  constructor(
    private readonly shoppingListService: ShoppingListService,
    private readonly authContext: AuthContextService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get shopping list" })
  @ApiOkResponse({
    description: "Shopping list",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "list_123" },
        title: { type: "string", example: "My shopping list" },
        categories: { type: "array", items: { type: "object" } },
        items: { type: "array", items: { type: "object" } },
      },
    },
  })
  async getList(@Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = await this.resolveUserId(headers);
    return this.shoppingListService.getList(userId);
  }

  @Get("categories")
  @ApiOperation({ summary: "List shopping categories" })
  @ApiOkResponse({
    description: "Shopping categories",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", example: "cat_123" },
          name: { type: "string", example: "Dairy" },
        },
      },
    },
  })
  async listCategories(@Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = await this.resolveUserId(headers);
    return this.shoppingListService.listCategories(userId);
  }

  @Post("categories")
  @ApiOperation({ summary: "Add category" })
  @ApiBody({
    type: AddShoppingCategoryDto,
    examples: {
      create: {
        summary: "Create category",
        value: { name: "Dairy" },
      },
    },
  })
  @ApiOkResponse({
    description: "Created or updated category",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "cat_123" },
        name: { type: "string", example: "Dairy" },
      },
    },
  })
  async addCategory(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() dto: AddShoppingCategoryDto,
  ) {
    const userId = await this.resolveUserId(headers);
    return this.shoppingListService.addCategory(userId, dto);
  }

  @Patch("categories/:categoryId")
  @ApiOperation({ summary: "Update category" })
  @ApiParam({ name: "categoryId", example: "cat_123" })
  @ApiBody({
    type: UpdateShoppingCategoryDto,
    examples: {
      update: {
        summary: "Rename category",
        value: { name: "Vegetables" },
      },
    },
  })
  @ApiOkResponse({
    description: "Updated category",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "cat_123" },
        name: { type: "string", example: "Vegetables" },
      },
    },
  })
  async updateCategory(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param() params: ShoppingCategoryIdDto,
    @Body() dto: UpdateShoppingCategoryDto,
  ) {
    const userId = await this.resolveUserId(headers);
    return this.shoppingListService.updateCategory(userId, params.categoryId, dto);
  }

  @Delete("categories/:categoryId")
  @ApiOperation({ summary: "Remove category" })
  @ApiParam({ name: "categoryId", example: "cat_123" })
  @ApiOkResponse({
    description: "Remaining categories",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", example: "cat_123" },
          name: { type: "string", example: "Dairy" },
        },
      },
    },
  })
  async removeCategory(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param() params: ShoppingCategoryIdDto,
  ) {
    const userId = await this.resolveUserId(headers);
    return this.shoppingListService.removeCategory(userId, params.categoryId);
  }

  @Post("items")
  @ApiOperation({
    summary: "Add shopping item",
    description:
      "Adds an item to shopping list: either from products catalog (productId) or as free-text item (customName).",
  })
  @ApiBody({
    type: AddShoppingItemDto,
    examples: {
      product: {
        summary: "From product",
        description: "Use existing product from products catalog",
        value: { productId: "prod_123", amount: 2, unit: "pcs", categoryName: "Dairy" },
      },
      custom: {
        summary: "Not from products (free text)",
        description: "Use customName when item does not exist in products catalog",
        value: { customName: "Paper towels", amount: 1, unit: "pack", categoryName: "Home" },
      },
    },
  })
  @ApiOkResponse({
    description: "Updated shopping list after add item",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "list_123" },
        title: { type: "string", example: "My shopping list" },
        categories: { type: "array", items: { type: "object" } },
        items: { type: "array", items: { type: "object" } },
      },
    },
  })
  async addItem(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() dto: AddShoppingItemDto,
  ) {
    const userId = await this.resolveUserId(headers);
    return this.shoppingListService.addItem(userId, dto);
  }

  @Patch("items/:itemId")
  @ApiOperation({ summary: "Set item state" })
  @ApiParam({ name: "itemId", example: "item_123" })
  @ApiBody({
    type: SetShoppingItemStateDto,
    examples: {
      done: {
        summary: "Mark as done",
        value: { isDone: true },
      },
      undone: {
        summary: "Mark as not done",
        value: { isDone: false },
      },
    },
  })
  @ApiOkResponse({
    description: "Updated shopping list after state change",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "list_123" },
        title: { type: "string", example: "My shopping list" },
        categories: { type: "array", items: { type: "object" } },
        items: { type: "array", items: { type: "object" } },
      },
    },
  })
  async setItemState(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param() params: ShoppingItemIdDto,
    @Body() dto: SetShoppingItemStateDto,
  ) {
    const userId = await this.resolveUserId(headers);
    return this.shoppingListService.setItemState(userId, params.itemId, dto.isDone);
  }

  @Delete("items/:itemId")
  @ApiOperation({ summary: "Remove shopping item" })
  @ApiParam({ name: "itemId", example: "item_123" })
  @ApiOkResponse({
    description: "Updated shopping list after remove",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "list_123" },
        title: { type: "string", example: "My shopping list" },
        categories: { type: "array", items: { type: "object" } },
        items: { type: "array", items: { type: "object" } },
      },
    },
  })
  async removeItem(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param() params: ShoppingItemIdDto,
  ) {
    const userId = await this.resolveUserId(headers);
    return this.shoppingListService.removeItem(userId, params.itemId);
  }

  private async resolveUserId(
    headers: Record<string, string | string[] | undefined>,
  ) {
    const authHeader = headers["authorization"];
    const value = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    if (value && value.startsWith("Bearer ")) {
      return this.authContext.getOrCreateUserId(headers);
    }
    const devSub = process.env.DEV_AUTH_BYPASS_SUB || "dev-user";
    return this.authContext.getOrCreateByExternalId(devSub);
  }
}
