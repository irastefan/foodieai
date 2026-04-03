import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { AuthContextService } from "../auth/auth-context.service";
import { CreateSelfCareItemDto } from "./dto/create-self-care-item.dto";
import { CreateSelfCareSlotDto } from "./dto/create-self-care-slot.dto";
import { SelfCareItemIdDto } from "./dto/self-care-item-id.dto";
import { SelfCareSlotIdDto } from "./dto/self-care-slot-id.dto";
import { UpdateSelfCareItemDto } from "./dto/update-self-care-item.dto";
import { UpdateSelfCareSlotDto } from "./dto/update-self-care-slot.dto";
import { SelfCareRoutinesService } from "./self-care-routines.service";

@ApiTags("self-care-routines")
@ApiBearerAuth("bearer")
@Controller("v1/self-care-routines")
export class SelfCareRoutinesController {
  constructor(
    private readonly selfCareRoutinesService: SelfCareRoutinesService,
    private readonly authContext: AuthContextService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "Get weekly self-care routine",
    description: "Returns all 7 weekdays with ordered slots and ordered items inside each slot.",
  })
  @ApiOkResponse({
    description: "Weekly self-care routine",
    schema: {
      type: "object",
      properties: {
        weekdays: {
          type: "array",
          items: {
            type: "object",
            properties: {
              weekday: { type: "string", example: "MONDAY" },
              slots: { type: "array", items: { type: "object" } },
            },
          },
        },
      },
    },
  })
  async getWeek(@Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = await this.authContext.getUserId(headers);
    return this.selfCareRoutinesService.getWeek(userId);
  }

  @Post("slots")
  @ApiOperation({ summary: "Create self-care slot" })
  @ApiBody({
    type: CreateSelfCareSlotDto,
    examples: {
      morning: {
        summary: "Morning slot",
        value: { weekday: "MONDAY", name: "Morning", order: 1 },
      },
      evening: {
        summary: "Evening slot",
        value: { weekday: "MONDAY", name: "Evening", order: 2 },
      },
    },
  })
  @ApiOkResponse({ description: "Updated weekly self-care routine" })
  async createSlot(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() dto: CreateSelfCareSlotDto,
  ) {
    const userId = await this.authContext.getUserId(headers);
    return this.selfCareRoutinesService.createSlot(userId, dto);
  }

  @Patch("slots/:slotId")
  @ApiOperation({ summary: "Update self-care slot" })
  @ApiParam({ name: "slotId", example: "slot_123" })
  @ApiBody({
    type: UpdateSelfCareSlotDto,
    examples: {
      rename: {
        summary: "Rename slot",
        value: { name: "Late evening" },
      },
      move: {
        summary: "Move slot to another day",
        value: { weekday: "TUESDAY", order: 1 },
      },
    },
  })
  @ApiOkResponse({ description: "Updated weekly self-care routine" })
  async updateSlot(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param() params: SelfCareSlotIdDto,
    @Body() dto: UpdateSelfCareSlotDto,
  ) {
    const userId = await this.authContext.getUserId(headers);
    return this.selfCareRoutinesService.updateSlot(userId, params.slotId, dto);
  }

  @Delete("slots/:slotId")
  @ApiOperation({ summary: "Delete self-care slot" })
  @ApiParam({ name: "slotId", example: "slot_123" })
  @ApiOkResponse({ description: "Updated weekly self-care routine" })
  async removeSlot(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param() params: SelfCareSlotIdDto,
  ) {
    const userId = await this.authContext.getUserId(headers);
    return this.selfCareRoutinesService.removeSlot(userId, params.slotId);
  }

  @Post("slots/:slotId/items")
  @ApiOperation({ summary: "Create self-care item inside a slot" })
  @ApiParam({ name: "slotId", example: "slot_123" })
  @ApiBody({
    type: CreateSelfCareItemDto,
    examples: {
      serum: {
        summary: "Routine item",
        value: {
          title: "Vitamin C serum",
          description: "Apply after cleansing",
          note: "Skip on irritation days",
          order: 2,
        },
      },
    },
  })
  @ApiOkResponse({ description: "Updated weekly self-care routine" })
  async createItem(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param() params: SelfCareSlotIdDto,
    @Body() dto: CreateSelfCareItemDto,
  ) {
    const userId = await this.authContext.getUserId(headers);
    return this.selfCareRoutinesService.createItem(userId, params.slotId, dto);
  }

  @Patch("items/:itemId")
  @ApiOperation({ summary: "Update self-care item" })
  @ApiParam({ name: "itemId", example: "item_123" })
  @ApiBody({
    type: UpdateSelfCareItemDto,
    examples: {
      note: {
        summary: "Update note",
        value: { note: "Use 2 times per week only" },
      },
      reorder: {
        summary: "Move inside slot",
        value: { order: 1 },
      },
    },
  })
  @ApiOkResponse({ description: "Updated weekly self-care routine" })
  async updateItem(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param() params: SelfCareItemIdDto,
    @Body() dto: UpdateSelfCareItemDto,
  ) {
    const userId = await this.authContext.getUserId(headers);
    return this.selfCareRoutinesService.updateItem(userId, params.itemId, dto);
  }

  @Delete("items/:itemId")
  @ApiOperation({ summary: "Delete self-care item" })
  @ApiParam({ name: "itemId", example: "item_123" })
  @ApiOkResponse({ description: "Updated weekly self-care routine" })
  async removeItem(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param() params: SelfCareItemIdDto,
  ) {
    const userId = await this.authContext.getUserId(headers);
    return this.selfCareRoutinesService.removeItem(userId, params.itemId);
  }
}
