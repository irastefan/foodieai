import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
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
  constructor(private readonly prisma: PrismaService) {}

  async createManual(ownerUserId: string, dto: CreateProductDto): Promise<Product> {
    const normalizedName = this.normalizeName(dto.name);
    return this.prisma.product.create({
      data: {
        name: dto.name,
        brand: dto.brand ?? null,
        normalizedName,
        scope: dto.isPublic ? ProductScope.GLOBAL : ProductScope.USER,
        ownerUserId,
        status: ProductStatus.VERIFIED,
        source: ProductSource.INTERNAL,
        kcal100: dto.kcal100,
        protein100: dto.protein100,
        fat100: dto.fat100,
        carbs100: dto.carbs100,
      },
    });
  }

  async search(userId?: string, query?: string): Promise<Product[]> {
    const visibilityWhere: Prisma.ProductWhereInput = userId
      ? { OR: [{ scope: ProductScope.GLOBAL }, { ownerUserId: userId }] }
      : { scope: ProductScope.GLOBAL };

    const where: Prisma.ProductWhereInput = {
      AND: [
        visibilityWhere,
        query
          ? {
              OR: [
                { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
                { brand: { contains: query, mode: Prisma.QueryMode.insensitive } },
              ],
            }
          : {},
      ],
    };

    return this.prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async getByIdForUser(userId: string, productId: string) {
    return this.prisma.product.findFirst({
      where: {
        id: productId,
        OR: [{ scope: ProductScope.GLOBAL }, { ownerUserId: userId }],
      },
    });
  }

  async update(ownerUserId: string, productId: string, dto: UpdateProductDto): Promise<Product> {
    const existing = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!existing) {
      throw new NotFoundException({
        code: "PRODUCT_NOT_FOUND",
        message: "Product not found",
        productId,
      });
    }
    if (existing.ownerUserId !== ownerUserId) {
      throw new ForbiddenException({
        code: "PRODUCT_FORBIDDEN",
        message: "You can modify only your own products",
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
        scope: dto.isPublic === undefined
          ? undefined
          : dto.isPublic
            ? ProductScope.GLOBAL
            : ProductScope.USER,
      },
    });
  }

  async remove(ownerUserId: string, productId: string) {
    const existing = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!existing) {
      throw new NotFoundException({
        code: "PRODUCT_NOT_FOUND",
        message: "Product not found",
        productId,
      });
    }
    if (existing.ownerUserId !== ownerUserId) {
      throw new ForbiddenException({
        code: "PRODUCT_FORBIDDEN",
        message: "You can delete only your own products",
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

  private normalizeName(value: string) {
    return value.trim().toLowerCase();
  }
}
