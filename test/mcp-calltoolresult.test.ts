import assert from "assert";
import { jsonToTextContent } from "../src/mcp/mcp.content";

const payload = { user: { id: "u1" }, profile: null };
const content = jsonToTextContent(payload);

assert.strictEqual(content.type, "text", "content type should be text");
assert.ok(typeof content.text === "string", "content text should be string");
assert.deepStrictEqual(JSON.parse(content.text), payload, "JSON should round-trip");

console.log("mcp-calltoolresult.test passed");
