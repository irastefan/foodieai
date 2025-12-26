import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { formatSearchResult } from "./mcp.mapper";
import { McpService, McpValidationError } from "./mcp.service";

@ApiTags("mcp")
@Controller("mcp")
export class McpController {
  // MCP JSON-RPC entrypoint and status ping for ChatGPT connector.
  constructor(private readonly mcpService: McpService) {}

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
  @ApiBody({
    schema: { type: "object" },
    examples: {
      toolsList: {
        summary: "List tools",
        value: {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        },
      },
      toolsCallSearch: {
        summary: "Search products (public)",
        value: {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "product.search",
            arguments: {
              query: "yogurt",
            },
          },
        },
      },
      toolsCallCreate: {
        summary: "Create product",
        value: {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: {
            name: "product.createManual",
            arguments: {
              name: "Salmon",
              kcal100: 208,
              protein100: 20,
              fat100: 13,
              carbs100: 0,
            },
          },
        },
      },
    },
  })
  async handleMcp(@Body() body: unknown) {
    return this.handleJsonRpc(body);
  }

  // Core JSON-RPC router for MCP methods.
  private async handleJsonRpc(body: unknown) {
    const id = this.extractId(body);
    if (!this.isValidRequest(body)) {
      return this.error(id, -32600, "Invalid Request");
    }

    const request = body as {
      jsonrpc: string;
      id: number | string | null;
      method: string;
      params?: unknown;
    };

    switch (request.method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            serverInfo: { name: "FoodieAI MCP", version: "1.0.0" },
            capabilities: { tools: {} },
          },
        };
      case "tools/list":
        return {
          jsonrpc: "2.0",
          id,
          result: { tools: this.mcpService.listTools() },
        };
      case "resources/list":
        return {
          jsonrpc: "2.0",
          id,
          result: { resources: [] },
        };
      case "prompts/list":
        return {
          jsonrpc: "2.0",
          id,
          result: { prompts: [] },
        };
      case "tools/call": {
        const params = request.params as {
          name?: unknown;
          arguments?: unknown;
        };
        const name = params?.name;
        const args = params?.arguments;

        if (typeof name !== "string" || !this.isObject(args)) {
          return this.error(id, -32600, "Invalid Request");
        }

        if (name !== "product.createManual" && name !== "product.search") {
          return this.error(id, -32601, "Method not found");
        }

        try {
          if (name === "product.createManual") {
            const product = await this.mcpService.createManual(
              args as Record<string, unknown>,
            );
            // MCP CallToolResult content doesn't support type="json"; send JSON as text.
            const productJson = JSON.stringify(product);
            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  {
                    type: "text",
                    text: `✅ Product created: ${product.name}`,
                  },
                  { type: "text", text: productJson },
                ],
                isError: false,
              },
            };
          }

          const results = await this.mcpService.search(
            args as Record<string, unknown>,
          );
          const payload = formatSearchResult(results);
          // MCP CallToolResult content doesn't support type="json"; send JSON as text.
          const resultsJson = JSON.stringify(payload);
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                { type: "text", text: resultsJson },
              ],
              isError: false,
            },
          };
        } catch (error) {
          if (error instanceof McpValidationError) {
            return this.error(id, -32600, "Invalid Request", {
              errors: error.errors,
            });
          }
          return this.error(id, -32000, "Server error");
        }
      }
      default:
        return this.error(id, -32601, "Method not found");
    }
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
