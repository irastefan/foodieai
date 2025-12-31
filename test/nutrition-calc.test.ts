import * as assert from "assert";
import { RecipeDraftsService } from "../src/recipes/recipe-drafts.service";

(() => {
  const { total, perServing } = RecipeDraftsService.calculateNutritionTotals(
    [
      {
        amount: 200,
        unit: "g",
        kcal100: 100,
        protein100: 10,
        fat100: 5,
        carbs100: 12,
        product: null,
      },
      {
        amount: 0.5,
        unit: "kg",
        kcal100: 50,
        protein100: 5,
        fat100: 1,
        carbs100: 8,
        product: null,
      },
    ],
    4,
  );

  // First ingredient: 200g => kcal 200, protein 20, fat 10, carbs 24
  // Second: 500g => kcal 250, protein 25, fat 5, carbs 40
  // Totals: kcal 450, protein 45, fat 15, carbs 64
  assert(Math.abs(total.calories - 450) < 0.001);
  assert(Math.abs(total.protein - 45) < 0.001);
  assert(Math.abs(total.fat - 15) < 0.001);
  assert(Math.abs(total.carbs - 64) < 0.001);

  assert(Math.abs(perServing.calories - 112.5) < 0.001);
})();

(() => {
  // Skip unknown units and missing macros.
  const { total } = RecipeDraftsService.calculateNutritionTotals(
    [
      { amount: 100, unit: "pcs", kcal100: 10, protein100: 1, fat100: 1, carbs100: 1, product: null },
      { amount: null, unit: "g", kcal100: 100, protein100: 10, fat100: 10, carbs100: 10, product: null },
    ],
    2,
  );
  assert(total.calories === 0);
})();
