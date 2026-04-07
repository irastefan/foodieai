import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ActivityLevel, GoalType, Sex, TargetFormula } from "@prisma/client";
import { MacroProfile } from "../../tdee/macro-profile";

class TargetFormulaOptionDto {
  @ApiProperty({ enum: TargetFormula, example: TargetFormula.MIFFLIN_ST_JEOR })
  value!: TargetFormula;

  @ApiProperty({ example: "Mifflin-St Jeor" })
  label!: string;

  @ApiProperty({ example: "Modern default for BMR/TDEE based on sex, age, height, and weight." })
  description!: string;

  @ApiProperty({ example: true })
  isDefault!: boolean;
}

export class UserProfileResponseDto {
  @ApiProperty({ example: "profile_123" })
  id!: string;

  @ApiProperty({ example: "user_123" })
  userId!: string;

  @ApiPropertyOptional({ example: "Ira", nullable: true })
  firstName!: string | null;

  @ApiPropertyOptional({ example: "Stefan", nullable: true })
  lastName!: string | null;

  @ApiPropertyOptional({ enum: Sex, nullable: true })
  sex!: Sex | null;

  @ApiPropertyOptional({ example: "1994-05-10T00:00:00.000Z", nullable: true })
  birthDate!: Date | null;

  @ApiPropertyOptional({ example: 168, nullable: true })
  heightCm!: number | null;

  @ApiPropertyOptional({ example: 63, nullable: true })
  weightKg!: number | null;

  @ApiPropertyOptional({ enum: ActivityLevel, nullable: true })
  activityLevel!: ActivityLevel | null;

  @ApiPropertyOptional({ enum: GoalType, nullable: true })
  goal!: GoalType | null;

  @ApiProperty({ enum: MacroProfile, example: MacroProfile.BALANCED })
  macroProfile!: MacroProfile;

  @ApiProperty({ enum: TargetFormula, example: TargetFormula.MIFFLIN_ST_JEOR })
  targetFormula!: TargetFormula;

  @ApiPropertyOptional({ example: 400, nullable: true })
  calorieDelta!: number | null;

  @ApiPropertyOptional({ example: 1714, nullable: true })
  targetCalories!: number | null;

  @ApiPropertyOptional({ example: 126, nullable: true })
  targetProteinG!: number | null;

  @ApiPropertyOptional({ example: 50, nullable: true })
  targetFatG!: number | null;

  @ApiPropertyOptional({ example: 190, nullable: true })
  targetCarbsG!: number | null;

  @ApiProperty({ type: [TargetFormulaOptionDto] })
  availableTargetFormulas!: TargetFormulaOptionDto[];
}
