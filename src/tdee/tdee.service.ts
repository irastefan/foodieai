import { Injectable } from "@nestjs/common";
import { ActivityLevel, GoalType, Sex, TargetFormula } from "@prisma/client";
import { DEFAULT_TARGET_FORMULA, TARGET_FORMULAS } from "./tdee.constants";

type TargetInput = {
  sex: Sex;
  birthDate: Date;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: GoalType;
  targetFormula?: TargetFormula;
  calorieDelta?: number;
};

@Injectable()
export class TdeeService {
  // Deterministic calorie and macro calculator (Mifflin-St Jeor).
  calculateTargets(input: TargetInput) {
    const ageYears = this.calculateAgeYears(input.birthDate);
    const formula = input.targetFormula ?? TargetFormula.MIFFLIN_ST_JEOR;
    const bmr = this.calculateBmr(
      formula,
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
      targetFormula: formula,
    };
  }

  getFormulaOptions() {
    return TARGET_FORMULAS.map((formula) => ({ ...formula }));
  }

  getDefaultFormula() {
    return DEFAULT_TARGET_FORMULA;
  }

  private calculateBmr(
    formula: TargetFormula,
    sex: Sex,
    heightCm: number,
    weightKg: number,
    ageYears: number,
  ) {
    switch (formula) {
      case TargetFormula.HARRIS_BENEDICT_ORIGINAL:
        return this.calculateBmrHarrisBenedictOriginal(
          sex,
          heightCm,
          weightKg,
          ageYears,
        );
      case TargetFormula.HARRIS_BENEDICT_REVISED:
        return this.calculateBmrHarrisBenedictRevised(
          sex,
          heightCm,
          weightKg,
          ageYears,
        );
      case TargetFormula.OWEN:
        return this.calculateBmrOwen(sex, weightKg);
      case TargetFormula.MIFFLIN_ST_JEOR:
      default:
        return this.calculateBmrMifflin(
          sex,
          heightCm,
          weightKg,
          ageYears,
        );
    }
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

  private calculateBmrHarrisBenedictOriginal(
    sex: Sex,
    heightCm: number,
    weightKg: number,
    ageYears: number,
  ) {
    if (sex === Sex.MALE) {
      return 66.47 + 13.75 * weightKg + 5.003 * heightCm - 6.755 * ageYears;
    }
    return 655.1 + 9.563 * weightKg + 1.85 * heightCm - 4.676 * ageYears;
  }

  private calculateBmrHarrisBenedictRevised(
    sex: Sex,
    heightCm: number,
    weightKg: number,
    ageYears: number,
  ) {
    if (sex === Sex.MALE) {
      return 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * ageYears;
    }
    return 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * ageYears;
  }

  private calculateBmrOwen(sex: Sex, weightKg: number) {
    return sex === Sex.MALE
      ? 879 + 10.2 * weightKg
      : 795 + 7.18 * weightKg;
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
