import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { ActivityLevel, GoalType, Sex } from "@prisma/client";

export class UpsertUserProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEnum(Sex)
  sex?: Sex;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  heightCm?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  weightKg?: number;

  @IsOptional()
  @IsEnum(ActivityLevel)
  activityLevel?: ActivityLevel;

  @IsOptional()
  @IsEnum(GoalType)
  goal?: GoalType;

  @IsOptional()
  @IsInt()
  calorieDelta?: number;
}
