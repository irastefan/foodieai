import { BadGatewayException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { AiUsageService } from "../ai-access/ai-usage.service";
import { AiFeature } from "../ai-access/ai-access.constants";
import { CreateAiResponseDto } from "./dto/create-ai-response.dto";

type OpenAiUsage = {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
};

type ResolvedTools = {
  tools: unknown[];
  normalizedToOriginalName: Map<string, string>;
};

@Injectable()
export class AiService {
  constructor(private readonly aiUsageService: AiUsageService) {}

  async createResponse(
    userId: string,
    dto: CreateAiResponseDto,
  ) {
    const model = dto.model?.trim() || "gpt-5-mini";
    await this.aiUsageService.ensureCanExecute(userId, {
      feature: AiFeature.ADVANCED_AI_TOOLS,
      actionType: "responses.create",
      model,
    });

    const resolvedTools = this.resolveTools(dto.tools);
    const response = await this.callResponsesApi({
      model,
      input: dto.input,
      previous_response_id: dto.previous_response_id,
      tools: resolvedTools.tools,
      reasoning: dto.reasoning ?? { effort: "low" },
    });
    const remappedResponse = this.remapResponseToolNames(response, resolvedTools.normalizedToOriginalName);
    const usage = this.extractUsage(remappedResponse);

    const quota = await this.aiUsageService.recordUsage(userId, {
      actionType: "responses.create",
      feature: AiFeature.ADVANCED_AI_TOOLS,
      model,
      usage,
    });

    return {
      response: remappedResponse,
      aiUsage: quota,
    };
  }

  private async callResponsesApi(payload: Record<string, unknown>) {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException("OPENAI_API_KEY is not configured");
    }

    const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
    const fetchFn = (globalThis as any).fetch as
      | ((input: string, init?: Record<string, unknown>) => Promise<any>)
      | undefined;
    if (!fetchFn) {
      throw new ServiceUnavailableException("Global fetch is not available");
    }

    let upstreamResponse: any;
    try {
      upstreamResponse = await fetchFn(`${baseUrl}/responses`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      throw new BadGatewayException({
        code: "OPENAI_REQUEST_FAILED",
        message: "Failed to reach OpenAI Responses API",
        details: error instanceof Error ? error.message : String(error),
      });
    }

    let responseJson: Record<string, unknown> | null = null;
    try {
      responseJson = await upstreamResponse.json();
    } catch {
      responseJson = null;
    }

    if (!upstreamResponse.ok) {
      const upstreamError =
        responseJson && typeof responseJson.error === "object" && responseJson.error
          ? responseJson.error
          : responseJson;
      throw new BadGatewayException({
        code: "OPENAI_RESPONSE_ERROR",
        message: "OpenAI Responses API returned an error",
        status: upstreamResponse.status,
        details: upstreamError ?? null,
      });
    }

    if (!responseJson) {
      throw new BadGatewayException("OpenAI Responses API returned an empty body");
    }

    return responseJson;
  }

  private resolveTools(tools: unknown): ResolvedTools {
    const normalizedToOriginalName = new Map<string, string>();
    const usedNames = new Set<string>();

    if (Array.isArray(tools) && tools.length > 0) {
      return {
        tools: tools.map((tool) => this.normalizeTool(tool, normalizedToOriginalName, usedNames)),
        normalizedToOriginalName,
      };
    }

    const configured = process.env.OPENAI_DEFAULT_TOOLS?.trim();
    if (configured) {
      try {
        const parsed = JSON.parse(configured);
        if (Array.isArray(parsed)) {
          return {
            tools: parsed.map((tool) => this.normalizeTool(tool, normalizedToOriginalName, usedNames)),
            normalizedToOriginalName,
          };
        }
      } catch {
        // Ignore invalid env and fall back to defaults below.
      }
    }

    return {
      tools: [
        {
          type: "web_search_preview",
        },
      ],
      normalizedToOriginalName,
    };
  }

  private normalizeTool(
    tool: unknown,
    normalizedToOriginalName: Map<string, string>,
    usedNames: Set<string>,
  ) {
    if (!tool || typeof tool !== "object") {
      return tool;
    }

    const record = { ...(tool as Record<string, unknown>) };
    if (record.type === "function" && typeof record.name === "string") {
      const originalName = record.name;
      const normalizedName = this.normalizeFunctionToolName(originalName, usedNames);
      record.name = normalizedName;
      normalizedToOriginalName.set(normalizedName, originalName);
    }
    return record;
  }

  private normalizeFunctionToolName(name: string, usedNames: Set<string>) {
    const baseName = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 64) || "tool";

    let candidate = baseName;
    let index = 2;
    while (usedNames.has(candidate)) {
      const suffix = `_${index}`;
      candidate = `${baseName.slice(0, Math.max(1, 64 - suffix.length))}${suffix}`;
      index += 1;
    }

    usedNames.add(candidate);
    return candidate;
  }

  private remapResponseToolNames(
    response: Record<string, unknown>,
    normalizedToOriginalName: Map<string, string>,
  ) {
    if (normalizedToOriginalName.size === 0 || !Array.isArray(response.output)) {
      return response;
    }

    return {
      ...response,
      output: response.output.map((item) => {
        if (!item || typeof item !== "object") {
          return item;
        }

        const record = item as Record<string, unknown>;
        if (record.type !== "function_call" || typeof record.name !== "string") {
          return item;
        }

        const originalName = normalizedToOriginalName.get(record.name);
        if (!originalName) {
          return item;
        }

        return {
          ...record,
          name: originalName,
        };
      }),
    };
  }

  private extractUsage(response: Record<string, unknown>): OpenAiUsage {
    const usage = response.usage;
    if (!usage || typeof usage !== "object") {
      return { total_tokens: 0 };
    }

    const usageRecord = usage as Record<string, unknown>;
    return {
      prompt_tokens: this.toNumber(usageRecord.input_tokens ?? usageRecord.prompt_tokens),
      completion_tokens: this.toNumber(usageRecord.output_tokens ?? usageRecord.completion_tokens),
      total_tokens: this.toNumber(usageRecord.total_tokens),
    };
  }

  private toNumber(value: unknown) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.round(value));
  }
}
