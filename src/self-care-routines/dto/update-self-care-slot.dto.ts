import { PartialType } from "@nestjs/swagger";
import { CreateSelfCareSlotDto } from "./create-self-care-slot.dto";

export class UpdateSelfCareSlotDto extends PartialType(CreateSelfCareSlotDto) {}
