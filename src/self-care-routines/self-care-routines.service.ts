import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { CreateSelfCareItemDto } from "./dto/create-self-care-item.dto";
import { CreateSelfCareSlotDto } from "./dto/create-self-care-slot.dto";
import { UpdateSelfCareItemDto } from "./dto/update-self-care-item.dto";
import { UpdateSelfCareSlotDto } from "./dto/update-self-care-slot.dto";

const WEEKDAY_ORDER = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

type RoutineWeekday = (typeof WEEKDAY_ORDER)[number];

@Injectable()
export class SelfCareRoutinesService {
  constructor(private readonly prisma: PrismaService) {}

  async getWeek(userId: string) {
    const slots = await (this.prisma as any).selfCareRoutineSlot.findMany({
      where: { ownerUserId: userId },
      orderBy: [{ weekday: "asc" }, { order: "asc" }, { createdAt: "asc" }],
      include: {
        items: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    return {
      weekdays: WEEKDAY_ORDER.map((weekday) => ({
        weekday,
        slots: slots
          .filter((slot: any) => slot.weekday === weekday)
          .sort((left: any, right: any) => left.order - right.order)
          .map((slot: any) => this.formatSlot(slot)),
      })),
    };
  }

  async createSlot(userId: string, dto: CreateSelfCareSlotDto) {
    const weekday = this.parseWeekday(dto.weekday);
    const name = this.cleanRequiredText(dto.name, "slot name");
    const normalizedName = this.normalizeName(name);

    await this.prisma.$transaction(async (tx) => {
      await this.ensureSlotNameAvailable(tx as any, userId, weekday, normalizedName);

      const slots = await (tx as any).selfCareRoutineSlot.findMany({
        where: { ownerUserId: userId, weekday },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });

      const position = this.resolvePosition(dto.order, slots.length + 1);
      const slot = await (tx as any).selfCareRoutineSlot.create({
        data: {
          ownerUserId: userId,
          weekday,
          name,
          normalizedName,
          order: 0,
        },
        select: { id: true },
      });

      const orderedIds = slots.map((item: { id: string }) => item.id);
      orderedIds.splice(position - 1, 0, slot.id);
      await this.applySlotOrders(tx as any, userId, weekday, orderedIds);
    });

    return this.getWeek(userId);
  }

  async updateSlot(userId: string, slotId: string, dto: UpdateSelfCareSlotDto) {
    const slot = await (this.prisma as any).selfCareRoutineSlot.findFirst({
      where: { id: slotId, ownerUserId: userId },
      select: {
        id: true,
        weekday: true,
        name: true,
      },
    });

    if (!slot) {
      throw new NotFoundException({
        code: "SELF_CARE_SLOT_NOT_FOUND",
        message: "Self-care slot not found",
        slotId,
      });
    }

    const targetWeekday = dto.weekday ? this.parseWeekday(dto.weekday) : slot.weekday;
    const targetName = dto.name === undefined ? slot.name : this.cleanRequiredText(dto.name, "slot name");
    const targetNormalizedName = this.normalizeName(targetName);

    await this.prisma.$transaction(async (tx) => {
      await this.ensureSlotNameAvailable(tx as any, userId, targetWeekday, targetNormalizedName, slot.id);

      const targetSlots = await (tx as any).selfCareRoutineSlot.findMany({
        where: {
          ownerUserId: userId,
          weekday: targetWeekday,
          id: { not: slot.id },
        },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });

      const targetPosition = this.resolvePosition(dto.order, targetSlots.length + 1);
      const targetIds = targetSlots.map((item: { id: string }) => item.id);
      targetIds.splice(targetPosition - 1, 0, slot.id);

      await (tx as any).selfCareRoutineSlot.update({
        where: { id: slot.id },
        data: {
          weekday: targetWeekday,
          name: targetName,
          normalizedName: targetNormalizedName,
          order: 0,
        },
      });

      if (slot.weekday !== targetWeekday) {
        const sourceSlots = await (tx as any).selfCareRoutineSlot.findMany({
          where: {
            ownerUserId: userId,
            weekday: slot.weekday,
            id: { not: slot.id },
          },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          select: { id: true },
        });
        await this.applySlotOrders(
          tx as any,
          userId,
          slot.weekday,
          sourceSlots.map((item: { id: string }) => item.id),
        );
      }

      await this.applySlotOrders(tx as any, userId, targetWeekday, targetIds);
    });

    return this.getWeek(userId);
  }

  async removeSlot(userId: string, slotId: string) {
    const slot = await (this.prisma as any).selfCareRoutineSlot.findFirst({
      where: { id: slotId, ownerUserId: userId },
      select: { id: true, weekday: true },
    });

    if (!slot) {
      throw new NotFoundException({
        code: "SELF_CARE_SLOT_NOT_FOUND",
        message: "Self-care slot not found",
        slotId,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await (tx as any).selfCareRoutineSlot.delete({ where: { id: slot.id } });
      const remaining = await (tx as any).selfCareRoutineSlot.findMany({
        where: { ownerUserId: userId, weekday: slot.weekday },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      await this.applySlotOrders(
        tx as any,
        userId,
        slot.weekday,
        remaining.map((item: { id: string }) => item.id),
      );
    });

    return this.getWeek(userId);
  }

  async createItem(userId: string, slotId: string, dto: CreateSelfCareItemDto) {
    const slot = await (this.prisma as any).selfCareRoutineSlot.findFirst({
      where: { id: slotId, ownerUserId: userId },
      select: { id: true },
    });

    if (!slot) {
      throw new NotFoundException({
        code: "SELF_CARE_SLOT_NOT_FOUND",
        message: "Self-care slot not found",
        slotId,
      });
    }

    const title = this.cleanRequiredText(dto.title, "item title");
    const description = this.cleanOptionalText(dto.description);
    const note = this.cleanOptionalText(dto.note);

    await this.prisma.$transaction(async (tx) => {
      const items = await (tx as any).selfCareRoutineItem.findMany({
        where: { slotId: slot.id },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });

      const position = this.resolvePosition(dto.order, items.length + 1);
      const item = await (tx as any).selfCareRoutineItem.create({
        data: {
          slotId: slot.id,
          title,
          description,
          note,
          order: 0,
        },
        select: { id: true },
      });

      const orderedIds = items.map((existing: { id: string }) => existing.id);
      orderedIds.splice(position - 1, 0, item.id);
      await this.applyItemOrders(tx as any, slot.id, orderedIds);
    });

    return this.getWeek(userId);
  }

  async updateItem(userId: string, itemId: string, dto: UpdateSelfCareItemDto) {
    const item = await (this.prisma as any).selfCareRoutineItem.findFirst({
      where: {
        id: itemId,
        slot: { ownerUserId: userId },
      },
      select: {
        id: true,
        slotId: true,
        title: true,
        description: true,
        note: true,
      },
    });

    if (!item) {
      throw new NotFoundException({
        code: "SELF_CARE_ITEM_NOT_FOUND",
        message: "Self-care item not found",
        itemId,
      });
    }

    const title = dto.title === undefined ? item.title : this.cleanRequiredText(dto.title, "item title");
    const description = dto.description === undefined ? item.description : this.cleanOptionalText(dto.description);
    const note = dto.note === undefined ? item.note : this.cleanOptionalText(dto.note);

    await this.prisma.$transaction(async (tx) => {
      await (tx as any).selfCareRoutineItem.update({
        where: { id: item.id },
        data: {
          title,
          description,
          note,
        },
      });

      if (dto.order !== undefined) {
        const items = await (tx as any).selfCareRoutineItem.findMany({
          where: {
            slotId: item.slotId,
            id: { not: item.id },
          },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          select: { id: true },
        });
        const position = this.resolvePosition(dto.order, items.length + 1);
        const orderedIds = items.map((existing: { id: string }) => existing.id);
        orderedIds.splice(position - 1, 0, item.id);
        await this.applyItemOrders(tx as any, item.slotId, orderedIds);
      }
    });

    return this.getWeek(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const item = await (this.prisma as any).selfCareRoutineItem.findFirst({
      where: {
        id: itemId,
        slot: { ownerUserId: userId },
      },
      select: { id: true, slotId: true },
    });

    if (!item) {
      throw new NotFoundException({
        code: "SELF_CARE_ITEM_NOT_FOUND",
        message: "Self-care item not found",
        itemId,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await (tx as any).selfCareRoutineItem.delete({ where: { id: item.id } });
      const remaining = await (tx as any).selfCareRoutineItem.findMany({
        where: { slotId: item.slotId },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      await this.applyItemOrders(
        tx as any,
        item.slotId,
        remaining.map((existing: { id: string }) => existing.id),
      );
    });

    return this.getWeek(userId);
  }

  private formatSlot(slot: any) {
    return {
      id: slot.id,
      weekday: slot.weekday,
      name: slot.name,
      order: slot.order,
      items: (slot.items ?? []).map((item: any) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        note: item.note,
        order: item.order,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      createdAt: slot.createdAt,
      updatedAt: slot.updatedAt,
    };
  }

  private parseWeekday(value: string): RoutineWeekday {
    if (WEEKDAY_ORDER.includes(value as RoutineWeekday)) {
      return value as RoutineWeekday;
    }
    throw new BadRequestException("weekday must be one of MONDAY..SUNDAY");
  }

  private cleanRequiredText(value: string, fieldName: string) {
    const result = value.trim();
    if (!result) {
      throw new BadRequestException(`${fieldName} must not be empty`);
    }
    return result;
  }

  private cleanOptionalText(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }
    const result = value.trim();
    return result.length > 0 ? result : null;
  }

  private normalizeName(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
  }

  private resolvePosition(order: number | undefined, length: number) {
    if (!order || order < 1) {
      return length;
    }
    return Math.min(order, length);
  }

  private async ensureSlotNameAvailable(
    tx: any,
    userId: string,
    weekday: RoutineWeekday,
    normalizedName: string,
    excludeSlotId?: string,
  ) {
    const existing = await tx.selfCareRoutineSlot.findFirst({
      where: {
        ownerUserId: userId,
        weekday,
        normalizedName,
        ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException("slot with this name already exists for the selected weekday");
    }
  }

  private async applySlotOrders(tx: any, userId: string, weekday: RoutineWeekday, slotIds: string[]) {
    for (let index = 0; index < slotIds.length; index += 1) {
      await tx.selfCareRoutineSlot.updateMany({
        where: { id: slotIds[index], ownerUserId: userId, weekday },
        data: { order: index + 1000 },
      });
    }

    for (let index = 0; index < slotIds.length; index += 1) {
      await tx.selfCareRoutineSlot.updateMany({
        where: { id: slotIds[index], ownerUserId: userId, weekday },
        data: { order: index + 1 },
      });
    }
  }

  private async applyItemOrders(tx: any, slotId: string, itemIds: string[]) {
    for (let index = 0; index < itemIds.length; index += 1) {
      await tx.selfCareRoutineItem.updateMany({
        where: { id: itemIds[index], slotId },
        data: { order: index + 1000 },
      });
    }

    for (let index = 0; index < itemIds.length; index += 1) {
      await tx.selfCareRoutineItem.updateMany({
        where: { id: itemIds[index], slotId },
        data: { order: index + 1 },
      });
    }
  }
}
