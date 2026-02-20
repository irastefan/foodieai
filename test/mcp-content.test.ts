import * as assert from "assert";
import { buildMcpErrorResult, buildMcpResult } from "../src/mcp/mcp.utils";

function ensureTextOnly(content: Array<{ type: string; text?: string; [k: string]: unknown }>) {
  assert(Array.isArray(content));
  content.forEach((item) => {
    assert.strictEqual(item.type, "text");
    assert.strictEqual(typeof item.text, "string");
    assert.notStrictEqual((item.text as string).length, 0);
  });
  return content as Array<{ type: "text"; text: string }>;
}

(() => {
  const payload = { toolsByIntent: { demo: ["tool.a"] } };
  const result = buildMcpResult("✅ Capabilities", payload, { requestId: "req-1" });
  ensureTextOnly(result.content);
  assert.strictEqual(result.isError, false);
  assert((result.content as any[]).some((c) => c.text.includes("toolsByIntent")));
})();

(() => {
  const payload = { recipeId: "rec_123", recipe: { id: "rec_123", title: "Test" } };
  const result = buildMcpResult("✅ Recipe created", payload, { requestId: "req-4" });
  const content = ensureTextOnly(result.content);
  const text = content.map((c) => c.text).join("\n");
  assert(text.includes("\"recipeId\""));
  assert(text.includes("rec_123"));
})();

(() => {
  const payload = { profile: { firstName: "Ira" }, targets: { kcal: 2000 } };
  const result = buildMcpResult("✅ User profile loaded", payload, { requestId: "req-5" });
  const content = ensureTextOnly(result.content);
  const text = content.map((c) => c.text).join("\n");
  assert(text.includes("\"profile\""));
  assert(text.includes("\"targets\""));
})();

(() => {
  const payload = { count: 0, items: [] as Array<unknown> };
  const result = buildMcpResult("✅ Products found: 0", payload, { requestId: "req-6" });
  const content = ensureTextOnly(result.content);
  const text = content.map((c) => c.text).join("\n");
  assert(text.includes("\"items\""));
})();

(() => {
  const result = buildMcpResult("✅ Hello", "plain text payload", { requestId: "req-2" });
  ensureTextOnly(result.content);
  assert((result.content as any[]).some((c) => c.text.includes("plain text payload")));
})();

(() => {
  const result = buildMcpErrorResult("Something failed", { requestId: "req-3" });
  ensureTextOnly(result.content as Array<{ type: string; text: string }>);
  assert.strictEqual((result as { isError: boolean }).isError, true);
})();
