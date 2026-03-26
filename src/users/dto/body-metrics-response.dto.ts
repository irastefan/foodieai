import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class BodyMeasurementsResponseDto {
  @ApiPropertyOptional({ example: 72, nullable: true })
  neckCm!: number | null;

  @ApiPropertyOptional({ example: 89, nullable: true })
  bustCm!: number | null;

  @ApiPropertyOptional({ example: 76, nullable: true })
  underbustCm!: number | null;

  @ApiPropertyOptional({ example: 68, nullable: true })
  waistCm!: number | null;

  @ApiPropertyOptional({ example: 95, nullable: true })
  hipsCm!: number | null;

  @ApiPropertyOptional({ example: 28, nullable: true })
  bicepsCm!: number | null;

  @ApiPropertyOptional({ example: 24, nullable: true })
  forearmCm!: number | null;

  @ApiPropertyOptional({ example: 54, nullable: true })
  thighCm!: number | null;

  @ApiPropertyOptional({ example: 35, nullable: true })
  calfCm!: number | null;
}

export class BodyMetricsEntryResponseDto {
  @ApiProperty({ example: "metric_123" })
  id!: string;

  @ApiProperty({ example: "user_123" })
  userId!: string;

  @ApiProperty({ example: "2026-03-26" })
  date!: string;

  @ApiPropertyOptional({ example: 62.4, nullable: true })
  weightKg!: number | null;

  @ApiPropertyOptional({ type: BodyMeasurementsResponseDto, nullable: true })
  measurements!: BodyMeasurementsResponseDto | null;

  @ApiProperty({ example: "2026-03-26T08:12:00.000Z" })
  createdAt!: string;

  @ApiProperty({ example: "2026-03-26T08:20:00.000Z" })
  updatedAt!: string;
}
