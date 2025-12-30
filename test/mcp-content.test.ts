import * as assert from "assert";
import { buildMcpErrorResult, buildMcpResult } from "../src/mcp/mcp.utils";

function ensureTextOnly(content: Array<{ type: string; text: string }>) {
  assert(Array.isArray(content));
  content.forEach((item) => {
    assert.strictEqual(item.type, "text");
    assert.strictEqual(typeof item.text, "string");
    assert.notStrictEqual(item.text.length, 0);
  });
}

// Validate content shape for a typical tool (mcp.capabilities-like payload).
(() => {
  const payload = { toolsByIntent: { demo: ["tool.a"] } };
  const result = buildMcpResult("✅ Capabilities", payload, { requestId: "req-1" });
  ensureTextOnly(result.content);
  assert.strictEqual(result.isError, false);
  assert(result.content.some((c) => c.text.includes("toolsByIntent")));
})();

// Validate string payload passthrough.
(() => {
  const result = buildMcpResult("✅ Hello", "plain text payload", { requestId: "req-2" });
  ensureTextOnly(result.content);
  assert(result.content.some((c) => c.text.includes("plain text payload")));
})();

// Validate error representation stays text-only with isError flag.
(() => {
  const result = buildMcpErrorResult("Something failed", { requestId: "req-3" });
  ensureTextOnly(result.content as Array<{ type: string; text: string }>);
  assert.strictEqual((result as { isError: boolean }).isError, true);
})();
