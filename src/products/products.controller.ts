import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { CreateProductDto } from "./dto/create-product.dto";
import { ProductIdDto } from "./dto/product-id.dto";
import { SearchProductsDto } from "./dto/search-products.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductsService } from "./products.service";

@ApiTags("products")
@Controller("v1/products")
export class ProductsController {
  // REST endpoints for products (create, search).
  constructor(private readonly productsService: ProductsService) {}

  // Create a product manually (MVP).
  @ApiOperation({
    summary: "Create product manually",
    description:
      "Creates a product with MVP defaults (GLOBAL, VERIFIED, INTERNAL) and stores nutrition per 100g.",
  })
  @ApiBody({
    type: CreateProductDto,
    examples: {
      create: {
        summary: "Manual product",
        value: {
          name: "Greek Yogurt",
          brand: "Acme",
          kcal100: 120,
          protein100: 10,
          fat100: 3.5,
          carbs100: 8,
        },
      },
    },
  })
  @Post()
  async createManual(@Body() dto: CreateProductDto) {
    return this.productsService.createManual(dto);
  }

  // Search products by name/brand.
  @ApiOperation({
    summary: "Search products",
    description:
      "Search by name or brand with a simple case-insensitive contains filter.",
  })
  @ApiQuery({ name: "query", required: false, example: "yogurt" })
  @Get()
  async search(@Query() dto: SearchProductsDto) {
    return this.productsService.search(dto.query);
  }

  @Patch(":productId")
  @ApiOperation({
    summary: "Update product",
    description: "Updates mutable product fields.",
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
        },
      },
    },
  })
  async update(@Param() params: ProductIdDto, @Body() dto: UpdateProductDto) {
    return this.productsService.update(params.productId, dto);
  }

  @Delete(":productId")
  @ApiOperation({
    summary: "Delete product",
    description: "Deletes product if it is not used in recipes/shopping list.",
  })
  @ApiParam({ name: "productId", example: "prod_123" })
  async remove(@Param() params: ProductIdDto) {
    return this.productsService.remove(params.productId);
  }
}
