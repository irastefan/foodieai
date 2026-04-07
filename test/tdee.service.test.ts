import * as assert from "assert";
import { ActivityLevel, GoalType, Sex, TargetFormula } from "@prisma/client";
import { TdeeService } from "../src/tdee/tdee.service";

const service = new TdeeService();

const baseInput = {
  sex: Sex.FEMALE,
  birthDate: new Date(Date.UTC(1994, 4, 10)),
  heightCm: 168,
  weightKg: 63,
  activityLevel: ActivityLevel.MODERATE,
  goal: GoalType.MAINTAIN,
  targetFormula: TargetFormula.MIFFLIN_ST_JEOR,
};

const beforeBirthday = service.calculateTargets({
  ...baseInput,
  asOfDate: new Date(Date.UTC(2026, 4, 9)),
});
const onBirthday = service.calculateTargets({
  ...baseInput,
  asOfDate: new Date(Date.UTC(2026, 4, 10)),
});

assert.ok(
  onBirthday.targetCalories < beforeBirthday.targetCalories,
  "age should increase on birthday and slightly reduce calorie target",
);

const maintain = service.calculateTargets({
  ...baseInput,
  asOfDate: new Date(Date.UTC(2026, 3, 7)),
});
const lose = service.calculateTargets({
  ...baseInput,
  goal: GoalType.LOSE,
  asOfDate: new Date(Date.UTC(2026, 3, 7)),
});
const gain = service.calculateTargets({
  ...baseInput,
  goal: GoalType.GAIN,
  asOfDate: new Date(Date.UTC(2026, 3, 7)),
});

assert.ok(lose.targetCalories < maintain.targetCalories, "lose should reduce calories");
assert.ok(gain.targetCalories > maintain.targetCalories, "gain should increase calories");
assert.ok(lose.targetProteinG >= maintain.targetProteinG, "lose should not lower protein");
assert.ok(lose.targetFatG >= Math.ceil(baseInput.weightKg * 0.6), "fat should respect minimum floor");

const explicitDelta = service.calculateTargets({
  ...baseInput,
  goal: GoalType.GAIN,
  calorieDelta: 400,
  asOfDate: new Date(Date.UTC(2026, 3, 7)),
});
const explicitLosePositive = service.calculateTargets({
  ...baseInput,
  goal: GoalType.LOSE,
  calorieDelta: 400,
  asOfDate: new Date(Date.UTC(2026, 3, 7)),
});
const explicitLoseNegative = service.calculateTargets({
  ...baseInput,
  goal: GoalType.LOSE,
  calorieDelta: -400,
  asOfDate: new Date(Date.UTC(2026, 3, 7)),
});
const maintainWithDelta = service.calculateTargets({
  ...baseInput,
  goal: GoalType.MAINTAIN,
  calorieDelta: 400,
  asOfDate: new Date(Date.UTC(2026, 3, 7)),
});
const veryActive = service.calculateTargets({
  ...baseInput,
  goal: GoalType.MAINTAIN,
  activityLevel: ActivityLevel.VERY_ACTIVE,
  asOfDate: new Date(Date.UTC(2026, 3, 7)),
});

assert.ok(
  explicitDelta.targetCalories > gain.targetCalories,
  "positive calorieDelta should increase calories for gain goal",
);
assert.deepStrictEqual(
  explicitLosePositive,
  explicitLoseNegative,
  "lose goal should treat calorieDelta as absolute magnitude",
);
assert.deepStrictEqual(
  maintainWithDelta,
  maintain,
  "maintain goal should ignore calorieDelta",
);
assert.ok(
  veryActive.targetCalories > maintain.targetCalories,
  "very active factor should produce higher calories than moderate",
);

for (const result of [maintain, lose, gain]) {
  const macroCalories =
    result.targetProteinG * 4 + result.targetFatG * 9 + result.targetCarbsG * 4;
  assert.strictEqual(macroCalories, result.targetCalories, "target calories should equal macro calories");
}

assert.throws(
  () =>
    service.calculateTargets({
      ...baseInput,
      birthDate: new Date(Date.UTC(2030, 0, 1)),
      asOfDate: new Date(Date.UTC(2026, 3, 7)),
    }),
  /future/,
  "future birth dates should be rejected",
);

console.log("tdee.service.test passed");
