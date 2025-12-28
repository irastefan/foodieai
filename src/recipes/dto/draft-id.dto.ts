import { IsString } from "class-validator";

export class DraftIdDto {
  @IsString()
  draftId!: string;
}
