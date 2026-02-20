import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
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
  async getList(@Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = await this.resolveUserId(headers);
    return this.shoppingListService.getList(userId);
  }

  @Get("categories")
  @ApiOperation({ summary: "List shopping categories" })
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
