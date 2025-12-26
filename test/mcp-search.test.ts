import assert from "assert";
import { formatSearchResult } from "../src/mcp/mcp.mapper";

const sample = [
  {
    id: "prod_1",
    name: "Salmon",
    brand: null,
    kcal100: 208,
    protein100: 20,
    fat100: 13,
    carbs100: 0,
  },
];

const result = formatSearchResult(sample);

assert.ok(result.count >= 0, "count should be >= 0");
assert.ok(Array.isArray(result.items), "items should be an array");
assert.strictEqual(result.items.length, 1, "items length should match");
assert.ok(result.items[0].id, "item should have id");
assert.ok(result.items[0].name, "item should have name");

console.log("mcp-search.test passed");
