import { ApiPropertyOptional } from "@nestjs/swagger";
import { ActivityLevel, GoalType, Sex, TargetFormula } from "@prisma/client";
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { MacroProfile } from "../../tdee/macro-profile";

export class UpsertUserProfileDto {
  @ApiPropertyOptional({ example: "Ira" })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: "Stefan" })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ enum: Sex, example: Sex.FEMALE })
  @IsOptional()
  @IsEnum(Sex)
  sex?: Sex;

  @ApiPropertyOptional({ example: "1994-05-10" })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ example: 168 })
  @IsOptional()
  @IsInt()
  @Min(1)
  heightCm?: number;

  @ApiPropertyOptional({ example: 63 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  weightKg?: number;

  @ApiPropertyOptional({ enum: ActivityLevel, example: ActivityLevel.MODERATE })
  @IsOptional()
  @IsEnum(ActivityLevel)
  activityLevel?: ActivityLevel;

  @ApiPropertyOptional({ enum: GoalType, example: GoalType.LOSE })
  @IsOptional()
  @IsEnum(GoalType)
  goal?: GoalType;

  @ApiPropertyOptional({ enum: MacroProfile, example: MacroProfile.BALANCED })
  @IsOptional()
  @IsEnum(MacroProfile)
  macroProfile?: MacroProfile;

  @ApiPropertyOptional({ enum: TargetFormula, example: TargetFormula.MIFFLIN_ST_JEOR })
  @IsOptional()
  @IsEnum(TargetFormula)
  targetFormula?: TargetFormula;

  @ApiPropertyOptional({ example: 400 })
  @IsOptional()
  @IsInt()
  calorieDelta?: number;
}
