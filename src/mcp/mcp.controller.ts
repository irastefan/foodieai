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
import { buildMcpResult, McpHandledError, newRequestId } from "./mcp.utils";

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
      if (error.message === "VALIDATION_ERROR" || error.message === "DRAFT_INCOMPLETE") {
        console.warn(`[${requestId}] ${error.message}`, error.data);
      }
      return this.error(id, error.code, error.message, {
        ...(error.data as Record<string, unknown> | undefined),
        requestId,
      });
    }

    if (error instanceof UnauthorizedException) {
      return this.error(id, 401, "AUTH_REQUIRED", { requestId });
    }

    console.error(`[${requestId}] INTERNAL_ERROR`, error);
    return this.error(id, -32000, "INTERNAL_ERROR", { requestId });
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
