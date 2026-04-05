import * as assert from "assert";
import { McpService } from "../src/mcp/mcp.service";

(async () => {
  const historyCalls: Array<{ userId: string; dto: Record<string, unknown> }> = [];
  const copyCalls: Array<{ userId: string; dto: Record<string, unknown> }> = [];

  const service = new McpService(
    { createManual: async () => null, search: async () => [] } as any,
    { create: async () => null, search: async () => [], get: async () => null } as any,
    {
      getDay: async () => null,
      getHistory: async (userId: string, dto: Record<string, unknown>) => {
        historyCalls.push({ userId, dto });
        return { ok: true };
      },
      copySlot: async (userId: string, dto: Record<string, unknown>) => {
        copyCalls.push({ userId, dto });
        return { ok: true };
      },
      addEntry: async () => null,
      removeEntry: async () => null,
    } as any,
    {} as any,
    {} as any,
    {} as any,
  );

  await service.getMealPlanHistory("user_123", {
    fromDate: "2026-02-01",
    toDate: "2026-03-01",
    query: "protein bar",
  });
  await service.copyMealPlanSlot("user_123", {
    sourceDate: "2026-02-20",
    sourceSlot: "breakfast",
    targetDate: "2026-02-21",
    targetSlot: "snack",
  });

  assert.strictEqual(historyCalls.length, 1);
  assert.strictEqual(historyCalls[0]?.userId, "user_123");
  assert.deepStrictEqual({ ...historyCalls[0]?.dto }, {
    fromDate: "2026-02-01",
    toDate: "2026-03-01",
    query: "protein bar",
  });

  assert.strictEqual(copyCalls.length, 1);
  assert.strictEqual(copyCalls[0]?.userId, "user_123");
  assert.deepStrictEqual({ ...copyCalls[0]?.dto }, {
    sourceDate: "2026-02-20",
    sourceSlot: "breakfast",
    targetDate: "2026-02-21",
    targetSlot: "snack",
  });

  const toolResult = await service.executeTool(
    "mealPlan.copySlot",
    {
      sourceDate: "2026-02-20",
      sourceSlot: "DINNER",
      targetDate: "2026-02-21",
      targetSlot: "LUNCH",
    },
    { userId: "user_456", headers: {}, requestId: "req_1" },
  );

  assert.strictEqual(toolResult.text, "✅ Meal slot copied");
  assert.strictEqual(copyCalls[1]?.userId, "user_456");
  assert.deepStrictEqual({ ...copyCalls[1]?.dto }, {
    sourceDate: "2026-02-20",
    sourceSlot: "DINNER",
    targetDate: "2026-02-21",
    targetSlot: "LUNCH",
  });

  console.log("mcp-meal-plan-history-and-copy.test passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
