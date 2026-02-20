import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  Product,
  ProductScope,
  ProductSource,
  ProductStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

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

  async update(productId: string, dto: UpdateProductDto): Promise<Product> {
    const existing = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!existing) {
      throw new NotFoundException({
        code: "PRODUCT_NOT_FOUND",
        message: "Product not found",
        productId,
      });
    }

    return this.prisma.product.update({
      where: { id: productId },
      data: {
        name: dto.name ?? undefined,
        brand: dto.brand === undefined ? undefined : dto.brand,
        normalizedName: dto.name ? this.normalizeName(dto.name) : undefined,
        kcal100: dto.kcal100 ?? undefined,
        protein100: dto.protein100 ?? undefined,
        fat100: dto.fat100 ?? undefined,
        carbs100: dto.carbs100 ?? undefined,
      },
    });
  }

  async remove(productId: string) {
    const existing = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!existing) {
      throw new NotFoundException({
        code: "PRODUCT_NOT_FOUND",
        message: "Product not found",
        productId,
      });
    }

    const [recipeRefCount, shoppingRefCount] = await Promise.all([
      this.prisma.recipeIngredient.count({ where: { productId } }),
      (this.prisma as any).shoppingListItem.count({ where: { productId } }),
    ]);

    if (recipeRefCount > 0 || shoppingRefCount > 0) {
      throw new ConflictException({
        code: "PRODUCT_IN_USE",
        message: "Cannot delete product because it is used in recipes or shopping list",
        productId,
        recipeRefCount,
        shoppingRefCount,
      });
    }

    await this.prisma.product.delete({ where: { id: productId } });
    return { deleted: true, productId };
  }

  // Normalize product names for basic matching.
  private normalizeName(value: string) {
    return value.trim().toLowerCase();
  }
}
