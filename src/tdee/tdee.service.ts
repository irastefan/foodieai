import { Injectable } from "@nestjs/common";
import { ActivityLevel, GoalType, Sex } from "@prisma/client";

type TargetInput = {
  sex: Sex;
  birthDate: Date;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: GoalType;
  calorieDelta?: number;
};

@Injectable()
export class TdeeService {
  // Deterministic calorie and macro calculator (Mifflin-St Jeor).
  calculateTargets(input: TargetInput) {
    const ageYears = this.calculateAgeYears(input.birthDate);
    const bmr = this.calculateBmrMifflin(
      input.sex,
      input.heightCm,
      input.weightKg,
      ageYears,
    );
    const factor = this.activityFactor(input.activityLevel);
    const tdee = bmr * factor;

    const delta =
      input.calorieDelta ??
      (input.goal === GoalType.LOSE
        ? -400
        : input.goal === GoalType.GAIN
          ? 250
          : 0);

    const targetCalories = Math.round(tdee + delta);

    const proteinG = Math.round(
      input.weightKg * (input.goal === GoalType.GAIN ? 1.8 : 1.6),
    );
    const fatG = Math.round(input.weightKg * 0.8);
    const carbsG = Math.max(
      0,
      Math.round((targetCalories - proteinG * 4 - fatG * 9) / 4),
    );

    return {
      targetCalories,
      targetProteinG: proteinG,
      targetFatG: fatG,
      targetCarbsG: carbsG,
    };
  }

  private calculateBmrMifflin(
    sex: Sex,
    heightCm: number,
    weightKg: number,
    ageYears: number,
  ) {
    const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
    return sex === Sex.MALE ? base + 5 : base - 161;
  }

  private activityFactor(level: ActivityLevel) {
    switch (level) {
      case ActivityLevel.SEDENTARY:
        return 1.2;
      case ActivityLevel.LIGHT:
        return 1.375;
      case ActivityLevel.MODERATE:
        return 1.55;
      case ActivityLevel.VERY_ACTIVE:
        return 1.725;
      default:
        return 1.2;
    }
  }

  private calculateAgeYears(birthDate: Date) {
    const now = new Date();
    let years = now.getUTCFullYear() - birthDate.getUTCFullYear();
    const monthDiff = now.getUTCMonth() - birthDate.getUTCMonth();
    const dayDiff = now.getUTCDate() - birthDate.getUTCDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      years -= 1;
    }
    return Math.max(0, years);
  }
}
