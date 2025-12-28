import { IsArray, IsString } from "class-validator";

export class SetRecipeDraftStepsDto {
  @IsString()
  draftId!: string;

  @IsArray()
  @IsString({ each: true })
  steps!: string[];
}
