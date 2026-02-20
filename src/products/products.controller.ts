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
import { CreateProductDto } from "./dto/create-product.dto";
import { ProductIdDto } from "./dto/product-id.dto";
import { SearchProductsDto } from "./dto/search-products.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductsService } from "./products.service";

@ApiTags("products")
@Controller("v1/products")
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly authContext: AuthContextService,
  ) {}

  @ApiBearerAuth("bearer")
  @ApiOperation({
    summary: "Create product manually",
    description: "Creates user-owned product and stores nutrition per 100g.",
  })
  @ApiBody({
    type: CreateProductDto,
    examples: {
      private: {
        summary: "Private product",
        value: {
          name: "Greek Yogurt",
          brand: "Acme",
          kcal100: 120,
          protein100: 10,
          fat100: 3.5,
          carbs100: 8,
          isPublic: false,
        },
      },
      public: {
        summary: "Public product",
        value: {
          name: "Whole Milk",
          kcal100: 61,
          protein100: 3.2,
          fat100: 3.3,
          carbs100: 4.8,
          isPublic: true,
        },
      },
    },
  })
  @ApiCreatedResponse({ description: "Created product" })
  @Post()
  async createManual(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() dto: CreateProductDto,
  ) {
    const userId = await this.authContext.getUserId(headers);
    return this.productsService.createManual(userId, dto);
  }

  @ApiOperation({
    summary: "Search products",
    description: "Returns public products and your own private products when Bearer token is provided.",
  })
  @ApiQuery({ name: "query", required: false, example: "yogurt" })
  @ApiOkResponse({ description: "Matched products" })
  @Get()
  async search(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query() dto: SearchProductsDto,
  ) {
    const userId = await this.authContext.getOptionalUserId(headers);
    return this.productsService.search(userId, dto.query);
  }

  @ApiBearerAuth("bearer")
  @Patch(":productId")
  @ApiOperation({
    summary: "Update product",
    description: "Updates mutable product fields. Only owner can update.",
  })
  @ApiParam({ name: "productId", example: "prod_123" })
  @ApiBody({
    type: UpdateProductDto,
    examples: {
      update: {
        summary: "Update macros",
        value: {
          name: "Greek Yogurt 2%",
          kcal100: 110,
          protein100: 11,
          fat100: 2.8,
          carbs100: 7.5,
          isPublic: true,
        },
      },
    },
  })
  @ApiOkResponse({ description: "Updated product" })
  async update(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param() params: ProductIdDto,
    @Body() dto: UpdateProductDto,
  ) {
    const userId = await this.authContext.getUserId(headers);
    return this.productsService.update(userId, params.productId, dto);
  }

  @ApiBearerAuth("bearer")
  @Delete(":productId")
  @ApiOperation({
    summary: "Delete product",
    description: "Deletes product if it is not used in recipes/shopping list. Only owner can delete.",
  })
  @ApiParam({ name: "productId", example: "prod_123" })
  @ApiResponse({
    status: 200,
    description: "Deletion result",
    schema: {
      type: "object",
      properties: {
        deleted: { type: "boolean", example: true },
        productId: { type: "string", example: "prod_123" },
      },
    },
  })
  async remove(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param() params: ProductIdDto,
  ) {
    const userId = await this.authContext.getUserId(headers);
    return this.productsService.remove(userId, params.productId);
  }
}
