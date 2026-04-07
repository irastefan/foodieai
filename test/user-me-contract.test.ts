import * as assert from "assert";
import { formatUserMe } from "../src/mcp/mcp.mapper";
import { TARGET_FORMULAS } from "../src/tdee/tdee.constants";

const profile = {
  firstName: "Ira",
  lastName: "Stefan",
  sex: "FEMALE",
  birthDate: new Date(Date.UTC(1994, 4, 10)),
  heightCm: 168,
  weightKg: 63,
  activityLevel: "MODERATE",
  goal: "LOSE",
  targetFormula: "MIFFLIN_ST_JEOR",
  calorieDelta: 400,
  targetCalories: 1714,
  targetProteinG: 126,
  targetFatG: 50,
  targetCarbsG: 190,
  availableTargetFormulas: TARGET_FORMULAS.map((formula) => ({ ...formula })),
};

const result = formatUserMe(profile);

assert.ok(result.profile, "profile should exist");
assert.ok(result.targets, "targets should exist");
assert.strictEqual(result.profile.firstName, "Ira");
assert.strictEqual(result.profile.targetFormula, "MIFFLIN_ST_JEOR");
assert.ok(result.profile.availableTargetFormulas.length >= 3);
assert.strictEqual(result.targets.kcal, 1714);
assert.ok(!("id" in (result as unknown as Record<string, unknown>)), "no id at top level");
assert.ok(!("user" in (result as unknown as Record<string, unknown>)), "no user object");

console.log("user-me-contract.test passed");
