import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { AddShoppingCategoryDto } from "./dto/add-shopping-category.dto";
import { AddShoppingItemDto } from "./dto/add-shopping-item.dto";

@Injectable()
export class ShoppingListService {
  constructor(private readonly prisma: PrismaService) {}

  async getList(userId: string) {
    const list = await this.getOrCreateList(userId);
    const [items, categories] = await Promise.all([
      (this.prisma as any).shoppingListItem.findMany({
        where: { listId: list.id },
        orderBy: [{ isDone: "asc" }, { createdAt: "desc" }],
        include: {
          product: { select: { id: true, name: true, brand: true } },
          category: { select: { id: true, name: true } },
        },
      }),
      (this.prisma as any).shoppingCategory.findMany({
        where: { ownerUserId: userId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    return {
      id: list.id,
      title: list.title,
      categories,
      items: items.map((item: any) => ({
        id: item.id,
        isDone: item.isDone,
        product: item.product,
        customName: item.customName,
        name: item.product?.name ?? item.customName,
        amount: item.amount,
        unit: item.unit,
        note: item.note,
        category: item.category,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    };
  }

  async addCategory(userId: string, dto: AddShoppingCategoryDto) {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException("category name must not be empty");
    }

    const normalizedName = this.normalizeName(name);
    const category = await (this.prisma as any).shoppingCategory.upsert({
      where: {
        ownerUserId_normalizedName: {
          ownerUserId: userId,
          normalizedName,
        },
      },
      update: { name },
      create: {
        ownerUserId: userId,
        name,
        normalizedName,
      },
      select: { id: true, name: true },
    });

    return category;
  }

  async listCategories(userId: string) {
    return (this.prisma as any).shoppingCategory.findMany({
      where: { ownerUserId: userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  }

  async addItem(userId: string, dto: AddShoppingItemDto) {
    const mode = this.resolveItemMode(dto);
    const list = await this.getOrCreateList(userId);
    const categoryId = await this.resolveCategoryId(userId, dto);

    let productId: string | null = null;
    let customName: string | null = null;

    if (mode === "product") {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId as string },
        select: { id: true },
      });
      if (!product) {
        throw new NotFoundException({
          code: "PRODUCT_NOT_FOUND",
          message: "Product not found",
          productId: dto.productId,
        });
      }
      productId = product.id;
    } else {
      customName = (dto.customName as string).trim();
    }

    await (this.prisma as any).shoppingListItem.create({
      data: {
        listId: list.id,
        productId,
        customName,
        amount: dto.amount ?? null,
        unit: dto.unit?.trim() ?? null,
        note: dto.note?.trim() ?? null,
        categoryId,
      },
    });

    return this.getList(userId);
  }

  async setItemState(userId: string, itemId: string, isDone: boolean) {
    const item = await (this.prisma as any).shoppingListItem.findFirst({
      where: {
        id: itemId,
        list: { ownerUserId: userId },
      },
      select: { id: true },
    });

    if (!item) {
      throw new NotFoundException({
        code: "SHOPPING_ITEM_NOT_FOUND",
        message: "Shopping item not found",
        itemId,
      });
    }

    await (this.prisma as any).shoppingListItem.update({
      where: { id: item.id },
      data: { isDone },
    });

    return this.getList(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const item = await (this.prisma as any).shoppingListItem.findFirst({
      where: {
        id: itemId,
        list: { ownerUserId: userId },
      },
      select: { id: true },
    });

    if (!item) {
      throw new NotFoundException({
        code: "SHOPPING_ITEM_NOT_FOUND",
        message: "Shopping item not found",
        itemId,
      });
    }

    await (this.prisma as any).shoppingListItem.delete({
      where: { id: item.id },
    });

    return this.getList(userId);
  }

  private async getOrCreateList(userId: string) {
    return (this.prisma as any).shoppingList.upsert({
      where: { ownerUserId: userId },
      update: {},
      create: { ownerUserId: userId },
      select: { id: true, title: true },
    });
  }

  private resolveItemMode(dto: AddShoppingItemDto): "product" | "custom" {
    const hasProduct = Boolean(dto.productId?.trim());
    const hasCustom = Boolean(dto.customName?.trim());

    if (hasProduct === hasCustom) {
      throw new BadRequestException("Provide exactly one of productId or customName");
    }
    return hasProduct ? "product" : "custom";
  }

  private async resolveCategoryId(userId: string, dto: AddShoppingItemDto) {
    const hasCategoryId = Boolean(dto.categoryId?.trim());
    const hasCategoryName = Boolean(dto.categoryName?.trim());

    if (hasCategoryId && hasCategoryName) {
      throw new BadRequestException("Provide either categoryId or categoryName, not both");
    }

    if (hasCategoryId) {
      const category = await (this.prisma as any).shoppingCategory.findFirst({
        where: { id: dto.categoryId, ownerUserId: userId },
        select: { id: true },
      });
      if (!category) {
        throw new NotFoundException({
          code: "SHOPPING_CATEGORY_NOT_FOUND",
          message: "Category not found",
          categoryId: dto.categoryId,
        });
      }
      return category.id;
    }

    if (hasCategoryName) {
      const category = await this.addCategory(userId, { name: dto.categoryName as string });
      return category.id;
    }

    return null;
  }

  private normalizeName(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
  }
}
