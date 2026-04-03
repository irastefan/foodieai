import { PartialType } from "@nestjs/swagger";
import { CreateSelfCareItemDto } from "./create-self-care-item.dto";

export class UpdateSelfCareItemDto extends PartialType(CreateSelfCareItemDto) {}
