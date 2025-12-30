import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { AuthContextService } from "../auth/auth-context.service";
import { McpService } from "./mcp.service";
import {
  buildMcpErrorResult,
  buildMcpResult,
  McpHandledError,
  newRequestId,
} from "./mcp.utils";

@ApiTags("mcp")
@Controller("mcp")
export class McpController {
  // MCP JSON-RPC entrypoint and status ping for ChatGPT connector.
  constructor(
    private readonly mcpService: McpService,
    private readonly authContext: AuthContextService,
  ) {}

  // Public health/status check for the MCP server.
  @Get()
  @ApiOperation({
    summary: "MCP status ping",
    description: "Public ping endpoint used to verify MCP server availability.",
  })
  getStatus() {
    return { name: "FoodieAI MCP", status: "ok" };
  }

  // MCP JSON-RPC v2 endpoint (tools/list, tools/call, initialize).
  @Post()
  @ApiOperation({
    summary: "MCP JSON-RPC endpoint",
    description:
      "Handles MCP methods: initialize, tools/list, tools/call, resources/list, prompts/list.",
  })
  @ApiResponse({
    status: 200,
    description: "tools/list response example",
    schema: {
      type: "object",
      example: {
        jsonrpc: "2.0",
        id: 1,
        result: {
          tools: [
            { name: "product.createManual", description: "Create a product manually in FoodieAI" },
            { name: "product.search", description: "Search products by name or brand" },
            { name: "user.me", description: "Get current user and profile" },
            { name: "userProfile.upsert", description: "Create or update user profile and calculate targets" },
            { name: "userTargets.recalculate", description: "Recalculate daily calorie and macro targets" },
            { name: "recipe.search", description: "Search recipes" },
            { name: "recipe.get", description: "Get a recipe by id" },
          ],
        },
      },
    },
  })
  @ApiBody({
    schema: {
      type: "object",
      example: {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      },
    },
    examples: {
      toolsList: {
        summary: "List all tools",
        value: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
      },
      capabilities: {
        summary: "Capabilities catalog",
        value: {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "mcp.capabilities", arguments: {} },
        },
      },
      helpRecipes: {
        summary: "Help: recipes",
        value: {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "mcp.help", arguments: { topic: "recipes" } },
        },
      },
      productSearch: {
        summary: "Search products",
        value: {
          jsonrpc: "2.0",
          id: 10,
          method: "tools/call",
          params: { name: "product.search", arguments: { query: "yogurt" } },
        },
      },
      productCreate: {
        summary: "Create product",
        value: {
          jsonrpc: "2.0",
          id: 11,
          method: "tools/call",
          params: {
            name: "product.createManual",
            arguments: { name: "Salmon", kcal100: 208, protein100: 20, fat100: 13, carbs100: 0 },
          },
        },
      },
      userMe: {
        summary: "Current user",
        value: {
          jsonrpc: "2.0",
          id: 20,
          method: "tools/call",
          params: { name: "user.me", arguments: {} },
        },
      },
      userProfileUpsert: {
        summary: "Upsert profile",
        value: {
          jsonrpc: "2.0",
          id: 21,
          method: "tools/call",
          params: {
            name: "userProfile.upsert",
            arguments: {
              firstName: "Ira",
              lastName: "Stefan",
              sex: "FEMALE",
              heightCm: 168,
              weightKg: 63,
            },
          },
        },
      },
      userTargetsRecalc: {
        summary: "Recalculate targets",
        value: {
          jsonrpc: "2.0",
          id: 22,
          method: "tools/call",
          params: { name: "userTargets.recalculate", arguments: {} },
        },
      },
      recipeDraftCreate: {
        summary: "Create draft",
        value: {
          jsonrpc: "2.0",
          id: 30,
          method: "tools/call",
          params: { name: "recipeDraft.create", arguments: { title: "Omelette", category: "breakfast" } },
        },
      },
      recipeDraftAddIngredient: {
        summary: "Add ingredient",
        value: {
          jsonrpc: "2.0",
          id: 31,
          method: "tools/call",
          params: {
            name: "recipeDraft.addIngredient",
            arguments: {
              draftId: "draft_123",
              ingredient: { name: "Egg", amount: 2, unit: "pcs" },
            },
          },
        },
      },
      recipeDraftRemoveIngredient: {
        summary: "Remove ingredient",
        value: {
          jsonrpc: "2.0",
          id: 32,
          method: "tools/call",
          params: {
            name: "recipeDraft.removeIngredient",
            arguments: { draftId: "draft_123", ingredientId: "ing_1" },
          },
        },
      },
      recipeDraftSetSteps: {
        summary: "Set steps",
        value: {
          jsonrpc: "2.0",
          id: 33,
          method: "tools/call",
          params: {
            name: "recipeDraft.setSteps",
            arguments: { draftId: "draft_123", steps: ["Beat eggs", "Cook", "Serve"] },
          },
        },
      },
      recipeDraftGet: {
        summary: "Get draft",
        value: {
          jsonrpc: "2.0",
          id: 34,
          method: "tools/call",
          params: { name: "recipeDraft.get", arguments: { draftId: "draft_123" } },
        },
      },
      recipeDraftValidate: {
        summary: "Validate draft",
        value: {
          jsonrpc: "2.0",
          id: 35,
          method: "tools/call",
          params: { name: "recipeDraft.validate", arguments: { draftId: "draft_123" } },
        },
      },
      recipeDraftPublish: {
        summary: "Publish draft",
        value: {
          jsonrpc: "2.0",
          id: 36,
          method: "tools/call",
          params: { name: "recipeDraft.publish", arguments: { draftId: "draft_123" } },
        },
      },
      recipeSearch: {
        summary: "Search recipes",
        value: {
          jsonrpc: "2.0",
          id: 40,
          method: "tools/call",
          params: {
            name: "recipe.search",
            arguments: { query: "omelette", category: "breakfast", limit: 5 },
          },
        },
      },
      recipeGet: {
        summary: "Get recipe",
        value: {
          jsonrpc: "2.0",
          id: 41,
          method: "tools/call",
          params: { name: "recipe.get", arguments: { recipeId: "rec_123" } },
        },
      },
    },
  })
  async handleMcp(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: Request & { user?: { userId: string; externalId: string } },
    @Body() body: unknown,
  ) {
    const requestId = newRequestId();
    return this.handleJsonRpc(body, headers, req.user, requestId);
  }

  // Core JSON-RPC router for MCP methods.
  private async handleJsonRpc(
    body: unknown,
    headers: Record<string, string | string[] | undefined>,
    user: { userId: string; externalId: string } | undefined,
    requestId: string,
  ) {
    const id = this.extractId(body);
    if (!this.isValidRequest(body)) {
      return this.error(id, -32600, "Invalid Request", { requestId });
    }

    const request = body as {
      jsonrpc: string;
      id: number | string | null;
      method: string;
      params?: unknown;
    };

    if (request.method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: { name: "FoodieAI MCP", version: "1.0.0" },
          capabilities: { tools: {} },
          requestId,
        },
      };
    }

    if (request.method === "tools/list") {
      return { jsonrpc: "2.0", id, result: { tools: this.mcpService.listTools(), requestId } };
    }

    if (request.method === "resources/list") {
      return { jsonrpc: "2.0", id, result: { resources: [], requestId } };
    }

    if (request.method === "prompts/list") {
      return { jsonrpc: "2.0", id, result: { prompts: [], requestId } };
    }

    if (request.method === "tools/call") {
      const params = request.params as { name?: unknown; arguments?: unknown };
      if (typeof params?.name !== "string" || !this.isObject(params?.arguments)) {
        return this.error(id, -32600, "Invalid Request", { requestId });
      }

      const toolDef = this.mcpService.getToolDefinition(params.name);
      if (!toolDef) {
        return this.error(id, -32601, "NOT_FOUND", { requestId });
      }

      try {
        const userId = toolDef.auth === "required" ? await this.resolveUserId(headers) : user?.userId;
        const payload = await this.mcpService.executeTool(
          params.name,
          params.arguments as Record<string, unknown>,
          { userId, headers: headers as Record<string, unknown>, requestId },
        );
        const result = buildMcpResult(payload.text, payload.json, {
          ...(payload.meta ?? {}),
          requestId,
          tool: toolDef.name,
        });
        return { jsonrpc: "2.0", id, result };
      } catch (error) {
        return this.handleToolError(id, error, requestId);
      }
    }

    return this.error(id, -32601, "Method not found", { requestId });
  }

  private handleToolError(id: number | string | null, error: unknown, requestId: string) {
    if (error instanceof McpHandledError) {
      const msg = error.message || "Error";
      console.warn(`[${requestId}] ${msg}`, error.data);
      const result = buildMcpErrorResult(msg, { requestId, code: error.code }, error.data);
      return { jsonrpc: "2.0", id, result };
    }

    if (error instanceof UnauthorizedException) {
      const result = buildMcpErrorResult("AUTH_REQUIRED", { requestId, code: 401 });
      return { jsonrpc: "2.0", id, result };
    }

    console.error(`[${requestId}] INTERNAL_ERROR`, error);
    const result = buildMcpErrorResult("INTERNAL_ERROR", { requestId, code: -32000 });
    return { jsonrpc: "2.0", id, result };
  }

  private isValidRequest(body: unknown): body is {
    jsonrpc: string;
    id: number | string | null;
    method: string;
  } {
    if (!this.isObject(body)) {
      return false;
    }
    if (body.jsonrpc !== "2.0") {
      return false;
    }
    if (typeof body.method !== "string") {
      return false;
    }
    return true;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  private extractId(body: unknown): number | string | null {
    if (!this.isObject(body)) {
      return null;
    }
    const id = body.id;
    if (typeof id === "string" || typeof id === "number" || id === null) {
      return id;
    }
    return null;
  }

  private error(
    id: number | string | null,
    code: number,
    message: string,
    data?: Record<string, unknown>,
  ) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message,
        ...(data ? { data } : {}),
      },
    };
  }

  private async resolveUserId(
    headers: Record<string, string | string[] | undefined>,
  ) {
    const authHeader = headers["authorization"];
    const value = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    if (value && value.startsWith("Bearer ")) {
      return this.authContext.getOrCreateUserId(headers);
    }
    const devSub = process.env.DEV_AUTH_BYPASS_SUB || "dev-user";
    return this.authContext.getOrCreateByExternalId(devSub);
  }
}
