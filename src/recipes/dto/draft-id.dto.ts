import { IsOptional, IsString } from "class-validator";

export class DraftIdDto {
  @IsString()
  draftId!: string;

  @IsOptional()
  @IsString()
  clientRequestId?: string | null;
}
