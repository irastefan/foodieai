import * as assert from "assert";
import { McpService } from "../src/mcp/mcp.service";

type Call = {
  userId: string;
  slotId: string;
  dto: Record<string, unknown>;
};

(async () => {
  const calls: Call[] = [];

  const service = new McpService(
    { createManual: async () => null, search: async () => [] } as any,
    { create: async () => null, search: async () => [], get: async () => null } as any,
    { getDay: async () => null, getHistory: async () => null, addEntry: async () => null, removeEntry: async () => null } as any,
    {
      createItem: async (userId: string, slotId: string, dto: Record<string, unknown>) => {
        calls.push({ userId, slotId, dto });
        return { ok: true };
      },
    } as any,
    { getList: async () => null, addCategory: async () => null, addItem: async () => null, setItemState: async () => null, removeItem: async () => null } as any,
    { getUserWithProfile: async () => null, upsertProfile: async () => null, getBodyMetricsDay: async () => null, upsertBodyMetrics: async () => null, getBodyMetricsHistory: async () => null } as any,
  );

  await service.createSelfCareItem("user_123", {
    slotId: "slot_123",
    title: "Serum с витамином C",
    description: "1–2 капли утром",
  });

  assert.strictEqual(calls.length, 1, "createItem should be called once");
  assert.strictEqual(calls[0]?.userId, "user_123");
  assert.strictEqual(calls[0]?.slotId, "slot_123");
  assert.deepStrictEqual({ ...calls[0]?.dto }, {
    title: "Serum с витамином C",
    description: "1–2 капли утром",
  });

  console.log("mcp-selfcare-item-create.test passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
