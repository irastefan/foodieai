export const MacroProfile = {
  BALANCED: "BALANCED",
  HIGH_PROTEIN: "HIGH_PROTEIN",
  LOW_CARB: "LOW_CARB",
  HIGH_CARB: "HIGH_CARB",
} as const;

export type MacroProfile = (typeof MacroProfile)[keyof typeof MacroProfile];

export const MACRO_PROFILE_VALUES = Object.values(MacroProfile);
