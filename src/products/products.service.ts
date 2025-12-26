import { Injectable } from "@nestjs/common";
import {
  Product,
  ProductScope,
  ProductSource,
  ProductStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { CreateProductDto } from "./dto/create-product.dto";

@Injectable()
export class ProductsService {
  // Product persistence and query logic.
  constructor(private readonly prisma: PrismaService) {}

  // Create a product with MVP defaults (GLOBAL/VERIFIED/INTERNAL).
  async createManual(dto: CreateProductDto): Promise<Product> {
    const normalizedName = this.normalizeName(dto.name);
    return this.prisma.product.create({
      data: {
        name: dto.name,
        brand: dto.brand ?? null,
        normalizedName,
        scope: ProductScope.GLOBAL,
        status: ProductStatus.VERIFIED,
        source: ProductSource.INTERNAL,
        kcal100: dto.kcal100,
        protein100: dto.protein100,
        fat100: dto.fat100,
        carbs100: dto.carbs100,
      },
    });
  }

  // Search by name/brand (case-insensitive).
  async search(query?: string): Promise<Product[]> {
    const where: Prisma.ProductWhereInput | undefined = query
      ? {
          OR: [
            { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { brand: { contains: query, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : undefined;

    return this.prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  // Normalize product names for basic matching.
  private normalizeName(value: string) {
    return value.trim().toLowerCase();
  }
}
