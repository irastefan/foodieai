export const TARGET_FORMULAS = [
  {
    value: "MIFFLIN_ST_JEOR",
    label: "Mifflin-St Jeor",
    description: "Modern default for BMR/TDEE based on sex, age, height, and weight.",
    isDefault: true,
  },
  {
    value: "HARRIS_BENEDICT_ORIGINAL",
    label: "Harris-Benedict Original",
    description: "Classic BMR formula using sex, age, height, and weight.",
    isDefault: false,
  },
  {
    value: "HARRIS_BENEDICT_REVISED",
    label: "Harris-Benedict Revised",
    description: "Updated Harris-Benedict variant with revised coefficients.",
    isDefault: false,
  },
  {
    value: "OWEN",
    label: "Owen",
    description: "Simpler BMR formula using body weight only.",
    isDefault: false,
  },
] as const;

export const DEFAULT_TARGET_FORMULA = "MIFFLIN_ST_JEOR";

export type TargetFormulaOption = (typeof TARGET_FORMULAS)[number];
