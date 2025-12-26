import { IsObject, IsOptional, IsString } from "class-validator";

export class McpRequestDto {
  @IsString()
  tool!: string;

  @IsOptional()
  @IsObject()
  args?: Record<string, unknown>;
}
