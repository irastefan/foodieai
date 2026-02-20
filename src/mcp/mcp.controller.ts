import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
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
  constructor(
    private readonly mcpService: McpService,
    private readonly authContext: AuthContextService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "MCP status ping",
    description: "Public ping endpoint used to verify MCP server availability.",
  })
  getStatus() {
    return { name: "FoodieAI MCP", status: "ok" };
  }

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
            { name: "recipe.create", description: "Create recipe in one call" },
            { name: "recipe.search", description: "Search recipes" },
            { name: "recipe.get", description: "Get a recipe by id" },
            { name: "mealPlan.dayGet", description: "Get day meal plan" },
            { name: "mealPlan.addEntry", description: "Add product or recipe to meal plan slot" },
            { name: "mealPlan.removeEntry", description: "Remove meal plan entry" },
            { name: "shoppingList.get", description: "Get shopping list" },
            { name: "shoppingList.addCategory", description: "Add shopping category" },
            { name: "shoppingList.addItem", description: "Add shopping item" },
            { name: "shoppingList.setItemState", description: "Set shopping item done/undone" },
            { name: "shoppingList.removeItem", description: "Remove shopping item" },
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
      productSearch: {
        summary: "Search products",
        value: {
          jsonrpc: "2.0",
          id: 10,
          method: "tools/call",
          params: { name: "product.search", arguments: { query: "yogurt" } },
        },
      },
      recipeCreate: {
        summary: "Create recipe",
        value: {
          jsonrpc: "2.0",
          id: 30,
          method: "tools/call",
          params: {
            name: "recipe.create",
            arguments: {
              title: "Omelette",
              ingredients: [{ productId: "prod_egg", amount: 120, unit: "g" }],
              steps: ["Beat eggs", "Cook"],
            },
          },
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
      mealPlanDayGet: {
        summary: "Get day meal plan",
        value: {
          jsonrpc: "2.0",
          id: 50,
          method: "tools/call",
          params: { name: "mealPlan.dayGet", arguments: { date: "2026-02-20" } },
        },
      },
      mealPlanAddEntry: {
        summary: "Add meal entry",
        value: {
          jsonrpc: "2.0",
          id: 51,
          method: "tools/call",
          params: {
            name: "mealPlan.addEntry",
            arguments: { slot: "BREAKFAST", productId: "prod_123", amount: 150, unit: "g" },
          },
        },
      },
      shoppingListAddItem: {
        summary: "Add shopping item",
        value: {
          jsonrpc: "2.0",
          id: 61,
          method: "tools/call",
          params: {
            name: "shoppingList.addItem",
            arguments: { customName: "Paper towels", categoryName: "Home" },
          },
        },
      },
    },
  })
  async handleMcp(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: Request & { user?: { userId: string; email?: string } },
    @Body() body: unknown,
  ) {
    const requestId = newRequestId();
    return this.handleJsonRpc(body, headers, req.user, requestId);
  }

  private async handleJsonRpc(
    body: unknown,
    headers: Record<string, string | string[] | undefined>,
    user: { userId: string; email?: string } | undefined,
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
        const userId = toolDef.auth === "required"
          ? await this.authContext.getUserId(headers)
          : (await this.authContext.getOptionalUserId(headers)) ?? user?.userId;
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

    if (error instanceof HttpException) {
      const status = error.getStatus();
      const payload = error.getResponse();
      const message =
        typeof payload === "string"
          ? payload
          : Array.isArray((payload as Record<string, unknown>).message)
            ? ((payload as Record<string, unknown>).message as string[]).join("; ")
            : (((payload as Record<string, unknown>).message as string) ?? error.message);
      const code =
        status === 401
          ? "AUTH_REQUIRED"
          : status === 404
            ? "NOT_FOUND"
            : status === 400
              ? "BAD_REQUEST"
              : "HTTP_ERROR";
      const data = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : undefined;
      const result = buildMcpErrorResult(message, { requestId, code: status }, { code, ...(data ?? {}) });
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

}
