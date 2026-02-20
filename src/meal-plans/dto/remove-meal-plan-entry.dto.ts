import { IsString } from "class-validator";

export class RemoveMealPlanEntryDto {
  @IsString()
  entryId!: string;
}
