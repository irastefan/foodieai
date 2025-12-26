import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { CreateProductDto } from "./dto/create-product.dto";
import { SearchProductsDto } from "./dto/search-products.dto";
import { ProductsService } from "./products.service";

@ApiTags("products")
@Controller("v1/products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @ApiOperation({ summary: "Create product manually" })
  @Post()
  async createManual(@Body() dto: CreateProductDto) {
    return this.productsService.createManual(dto);
  }

  @ApiOperation({ summary: "Search products" })
  @ApiQuery({ name: "query", required: false, example: "yogurt" })
  @Get()
  async search(@Query() dto: SearchProductsDto) {
    return this.productsService.search(dto.query);
  }
}
