import { Injectable } from "@nestjs/common";
import { ActivityLevel, GoalType, Sex, TargetFormula } from "@prisma/client";
import { DEFAULT_TARGET_FORMULA, TARGET_FORMULAS } from "./tdee.constants";
import { MacroProfile } from "./macro-profile";

type TargetInput = {
  sex: Sex;
  birthDate: Date;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: GoalType;
  macroProfile?: MacroProfile;
  targetFormula?: TargetFormula;
  calorieDelta?: number;
  asOfDate?: Date;
};

@Injectable()
export class TdeeService {
  calculateTargets(input: TargetInput) {
    const ageYears = this.calculateAgeYears(input.birthDate, input.asOfDate);
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
    const macroProfile = input.macroProfile ?? MacroProfile.BALANCED;

    const baseCalories = this.normalizeTargetCalories(
      Math.round(tdee),
      bmr,
      input.sex,
    );
    const delta = this.resolveCalorieDelta(input.goal, input.calorieDelta);
    const desiredCalories = this.normalizeTargetCalories(
      baseCalories + delta,
      bmr,
      input.sex,
    );
    const { proteinG, fatG, carbsG } = this.calculateMacroTargets(
      input.weightKg,
      desiredCalories,
      input.goal,
      input.activityLevel,
      macroProfile,
    );
    const targetCalories = this.macroCalories(proteinG, fatG, carbsG);

    return {
      targetCalories,
      targetProteinG: proteinG,
      targetFatG: fatG,
      targetCarbsG: carbsG,
      macroProfile,
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

  private calculateMacroTargets(
    weightKg: number,
    targetCalories: number,
    goal: GoalType,
    activityLevel: ActivityLevel,
    macroProfile: MacroProfile,
  ) {
    const { proteinTargetPerKg, fatTargetPerKg, carbFloorPerKg } =
      this.macroProfileTargets(goal, macroProfile);
    const fatMinPerKg = 0.6;

    const proteinG = Math.round(weightKg * proteinTargetPerKg);
    const fatMinG = Math.ceil(weightKg * fatMinPerKg);
    const fatTargetG = Math.round(weightKg * fatTargetPerKg);
    const fatG = Math.max(fatTargetG, fatMinG);
    const carbFloorG = this.minimumCarbs(weightKg, activityLevel, goal, carbFloorPerKg);

    const carbsG = Math.max(carbFloorG, this.caloriesToCarbs(targetCalories, proteinG, fatG));
    return { proteinG, fatG, carbsG };
  }

  private caloriesToCarbs(targetCalories: number, proteinG: number, fatG: number) {
    return Math.max(0, Math.floor((targetCalories - proteinG * 4 - fatG * 9) / 4));
  }

  private macroCalories(proteinG: number, fatG: number, carbsG: number) {
    return proteinG * 4 + fatG * 9 + carbsG * 4;
  }

  private minimumCarbs(
    weightKg: number,
    activityLevel: ActivityLevel,
    goal: GoalType,
    carbFloorPerKg: number,
  ) {
    if (carbFloorPerKg <= 0) {
      return 0;
    }

    const activityMultiplier =
      activityLevel === ActivityLevel.VERY_ACTIVE
        ? 1.15
        : activityLevel === ActivityLevel.MODERATE
          ? 1
          : 0.85;
    const goalAdjustment = goal === GoalType.GAIN ? 1.1 : 1;

    return Math.round(weightKg * carbFloorPerKg * activityMultiplier * goalAdjustment);
  }

  private macroProfileTargets(goal: GoalType, macroProfile: MacroProfile) {
    switch (macroProfile) {
      case MacroProfile.HIGH_PROTEIN:
        return {
          proteinTargetPerKg:
            goal === GoalType.LOSE ? 2.2 : goal === GoalType.GAIN ? 2 : 1.9,
          fatTargetPerKg: 0.8,
          carbFloorPerKg: 0,
        };
      case MacroProfile.LOW_CARB:
        return {
          proteinTargetPerKg:
            goal === GoalType.LOSE ? 2.1 : goal === GoalType.GAIN ? 1.9 : 1.8,
          fatTargetPerKg: goal === GoalType.GAIN ? 1 : 0.95,
          carbFloorPerKg: 0.3,
        };
      case MacroProfile.HIGH_CARB:
        return {
          proteinTargetPerKg:
            goal === GoalType.LOSE ? 1.8 : goal === GoalType.GAIN ? 1.6 : 1.5,
          fatTargetPerKg: 0.7,
          carbFloorPerKg: 1,
        };
      case MacroProfile.BALANCED:
      default:
        return {
          proteinTargetPerKg:
            goal === GoalType.LOSE ? 2 : goal === GoalType.GAIN ? 1.8 : 1.6,
          fatTargetPerKg:
            goal === GoalType.LOSE ? 0.8 : goal === GoalType.GAIN ? 0.8 : 0.9,
          carbFloorPerKg: goal === GoalType.GAIN ? 0.5 : 0,
        };
    }
  }

  private normalizeTargetCalories(
    calculatedCalories: number,
    bmr: number,
    sex: Sex,
  ) {
    const sexFloor = sex === Sex.MALE ? 1500 : 1200;
    const bmrFloor = Math.round(bmr);

    return Math.max(calculatedCalories, sexFloor, bmrFloor);
  }

  private resolveCalorieDelta(goal: GoalType, calorieDelta?: number) {
    const baseDelta = Math.abs(
      calorieDelta ??
      (goal === GoalType.LOSE
        ? 200
        : goal === GoalType.GAIN
          ? 200
          : 0),
    );

    if (goal === GoalType.LOSE) {
      return -baseDelta;
    }
    if (goal === GoalType.GAIN) {
      return baseDelta;
    }
    return 0;
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
        return 1.9;
      default:
        return 1.2;
    }
  }

  private calculateAgeYears(birthDate: Date, asOfDate = new Date()) {
    const birth = new Date(birthDate);
    const now = new Date(asOfDate);
    if (Number.isNaN(birth.getTime())) {
      throw new Error("birthDate is invalid");
    }
    if (birth.getTime() > now.getTime()) {
      throw new Error("birthDate cannot be in the future");
    }

    const birthYear = birth.getUTCFullYear();
    const birthMonth = birth.getUTCMonth();
    const birthDay = birth.getUTCDate();
    const nowYear = now.getUTCFullYear();
    const nowMonth = now.getUTCMonth();
    const nowDay = now.getUTCDate();

    let years = nowYear - birthYear;
    const monthDiff = nowMonth - birthMonth;
    const dayDiff = nowDay - birthDay;
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      years -= 1;
    }
    return Math.max(0, years);
  }
}
