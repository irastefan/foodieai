import * as assert from "assert";
import { AiFeature } from "../src/ai-access/ai-access.constants";
import { AiService } from "../src/ai/ai.service";

const calls: Array<{ method: string; payload?: unknown }> = [];

const aiUsageService = {
  async ensureCanExecute(userId: string, input: { feature: string; actionType: string; model?: string }) {
    calls.push({ method: "ensureCanExecute", payload: { userId, ...input } });
    return { tokensRemaining: 1000 };
  },
  async recordUsage(
    userId: string,
    input: {
      actionType: string;
      feature?: string;
      model: string;
      usage: { prompt_tokens?: number | null; completion_tokens?: number | null; total_tokens?: number | null };
    },
  ) {
    calls.push({ method: "recordUsage", payload: { userId, ...input } });
    return { tokensRemaining: 850, availableFeatures: [AiFeature.ADVANCED_AI_TOOLS] };
  },
};

const originalFetch = (globalThis as any).fetch;
(globalThis as any).fetch = async (_url: string, init?: { body?: string }) => {
  const payload = init?.body ? JSON.parse(init.body) : null;
  calls.push({ method: "fetch", payload });
  return {
    ok: true,
    async json() {
      const functionTool = Array.isArray(payload?.tools)
        ? payload.tools.find((tool: { type?: string }) => tool?.type === "function")
        : null;
      return {
        id: "resp_123",
        object: "response",
        output_text: "hello",
        output: functionTool
          ? [
            {
              type: "function_call",
              name: functionTool.name,
              call_id: "call_123",
              arguments: "{}",
            },
          ]
          : [],
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          total_tokens: 150,
        },
      };
    },
  };
};

process.env.OPENAI_API_KEY = "test-openai-api-key";

const service = new AiService(aiUsageService as any);

(async () => {
  const result = await service.createResponse("user_123", {
    model: "gpt-5-mini",
    input: "Say hello",
  });

  assert.strictEqual(result.response.id, "resp_123");
  assert.strictEqual(result.aiUsage.tokensRemaining, 850);
  assert.strictEqual(calls[0]?.method, "ensureCanExecute");
  assert.deepStrictEqual(calls[0]?.payload, {
    userId: "user_123",
    feature: AiFeature.ADVANCED_AI_TOOLS,
    actionType: "responses.create",
    model: "gpt-5-mini",
  });
  assert.strictEqual(calls[1]?.method, "fetch");
  assert.deepStrictEqual(calls[1]?.payload, {
    model: "gpt-5-mini",
    input: "Say hello",
    tools: [{ type: "web_search_preview" }],
    reasoning: { effort: "low" },
  });
  assert.strictEqual(calls[2]?.method, "recordUsage");
  assert.deepStrictEqual(calls[2]?.payload, {
    userId: "user_123",
    actionType: "responses.create",
    feature: AiFeature.ADVANCED_AI_TOOLS,
    model: "gpt-5-mini",
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    },
  });

  const functionToolResult = await service.createResponse("user_123", {
    model: "gpt-5-mini",
    input: "Call a tool",
    tools: [
      {
        type: "function",
        name: "mealPlan.dayGet",
        description: "Get meal plan",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    ],
  });

  assert.deepStrictEqual(calls[4]?.payload, {
    model: "gpt-5-mini",
    input: "Call a tool",
    tools: [
      {
        type: "function",
        name: "mealplan_dayget",
        description: "Get meal plan",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    ],
    reasoning: { effort: "low" },
  });
  const functionToolOutput = (functionToolResult.response as { output?: Array<{ name?: string }> }).output ?? [];
  assert.strictEqual(functionToolOutput[0]?.name, "mealPlan.dayGet");

  console.log("ai.service.test passed");
})()
  .finally(() => {
    (globalThis as any).fetch = originalFetch;
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
