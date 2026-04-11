import { Allow, IsDefined, IsOptional, IsString } from "class-validator";

export class CreateAiResponseDto {
  @IsOptional()
  @IsString()
  model?: string;

  @IsDefined()
  @Allow()
  input!: unknown;

  @IsOptional()
  @IsString()
  previous_response_id?: string;

  @IsOptional()
  @Allow()
  tools?: unknown;

  @IsOptional()
  @Allow()
  reasoning?: unknown;
}
