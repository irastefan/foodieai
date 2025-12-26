import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { CreateProductDto } from "./dto/create-product.dto";
import { SearchProductsDto } from "./dto/search-products.dto";
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
}
