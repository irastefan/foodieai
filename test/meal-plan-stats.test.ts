import * as assert from "assert";
import { MealPlansService } from "../src/meal-plans/meal-plans.service";

const profile = {
  targetCalories: 1673,
  targetProteinG: 126,
  targetFatG: 50,
  targetCarbsG: 240,
};

const days = [
  {
    date: new Date("2026-04-12T00:00:00.000Z"),
    nutritionTotal: { calories: 1700, protein: 120, fat: 48, carbs: 180 },
  },
  {
    date: new Date("2026-04-14T00:00:00.000Z"),
    nutritionTotal: { calories: 1400, protein: 110, fat: 45, carbs: 130 },
  },
];

const prisma = {
  mealPlanDay: {
    async findMany() {
      return days;
    },
  },
  userProfile: {
    async findUnique() {
      return profile;
    },
  },
};

(async () => {
  const service = new MealPlansService(prisma as any);
  const result = await service.getStats("user_123", { period: "week", date: "2026-04-18" });

  assert.strictEqual(result.period, "week");
  assert.strictEqual(result.fromDate, "2026-04-12");
  assert.strictEqual(result.toDate, "2026-04-18");
  assert.strictEqual(result.daysCount, 7);
  assert.deepStrictEqual(result.goals, {
    calories: 1673,
    protein: 126,
    fat: 50,
    carbs: 240,
  });
  assert.deepStrictEqual(result.totals, {
    calories: 3100,
    protein: 230,
    fat: 93,
    carbs: 310,
  });
  assert.deepStrictEqual(result.goalTotals, {
    calories: 11711,
    protein: 882,
    fat: 350,
    carbs: 1680,
  });
  assert.strictEqual(result.points.length, 7);
  assert.strictEqual(result.points[0]?.date, "2026-04-12");
  assert.strictEqual(result.points[1]?.date, "2026-04-13");
  assert.strictEqual(result.points[1]?.hasEntries, false);
  assert.deepStrictEqual(result.points[1]?.nutritionTotal, {
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
  });
  assert.strictEqual(result.averages.calories, 3100 / 7);

  console.log("meal-plan-stats.test passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
