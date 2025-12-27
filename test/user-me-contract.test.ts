import assert from "assert";
import { formatUserMe } from "../src/mcp/mcp.mapper";

const profile = {
  firstName: "Ira",
  lastName: "Stefan",
  sex: "FEMALE",
  birthDate: new Date(Date.UTC(1994, 4, 10)),
  heightCm: 168,
  weightKg: 63,
  activityLevel: "MODERATE",
  goal: "LOSE",
  calorieDelta: -400,
  targetCalories: 1850,
  targetProteinG: 120,
  targetFatG: 55,
  targetCarbsG: 210,
};

const result = formatUserMe(profile);

assert.ok(result.profile, "profile should exist");
assert.ok(result.targets, "targets should exist");
assert.strictEqual(result.profile.firstName, "Ira");
assert.strictEqual(result.targets.kcal, 1850);
assert.ok(!("id" in (result as unknown as Record<string, unknown>)), "no id at top level");
assert.ok(!("user" in (result as unknown as Record<string, unknown>)), "no user object");

console.log("user-me-contract.test passed");
