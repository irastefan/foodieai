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
import { jsonToTextContent } from "./mcp.content";
import { formatSearchResult, formatUserMe } from "./mcp.mapper";
import { McpService, McpValidationError } from "./mcp.service";
import { MissingFieldsError } from "../users/users.service";
import {
  DraftIncompleteError,
  RecipeDraftNotFoundError,
  RecipeNotFoundError,
} from "../recipes/recipes.errors";

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
            {
              name: "product.createManual",
              description: "Create a product manually in FoodieAI",
            },
            {
              name: "product.search",
              description: "Search products by name or brand",
            },
            {
              name: "user.me",
              description: "Get current user and profile",
            },
            {
              name: "userProfile.upsert",
              description: "Create or update user profile and calculate targets",
            },
            {
              name: "userTargets.recalculate",
              description: "Recalculate daily calorie and macro targets",
            },
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
      toolsCallUserMe: {
        summary: "Get current user",
        value: {
          jsonrpc: "2.0",
          id: 10,
          method: "tools/call",
          params: {
            name: "user.me",
            arguments: {},
          },
        },
      },
      toolsCallUserProfileUpsert: {
        summary: "Upsert user profile",
        value: {
          jsonrpc: "2.0",
          id: 11,
          method: "tools/call",
          params: {
            name: "userProfile.upsert",
            arguments: {
              firstName: "Ira",
              lastName: "Stefan",
              sex: "FEMALE",
              birthDate: "1994-05-10",
              heightCm: 168,
              weightKg: 63,
              activityLevel: "MODERATE",
              goal: "LOSE",
              calorieDelta: -400,
            },
          },
        },
      },
      toolsCallUserTargetsRecalculate: {
        summary: "Recalculate targets",
        value: {
          jsonrpc: "2.0",
          id: 12,
          method: "tools/call",
          params: {
            name: "userTargets.recalculate",
            arguments: {},
          },
        },
      },
    },
  })
  async handleMcp(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: Request & { user?: { userId: string; externalId: string } },
    @Body() body: unknown,
  ) {
    return this.handleJsonRpc(body, headers, req.user);
  }

  // Core JSON-RPC router for MCP methods.
  private async handleJsonRpc(
    body: unknown,
    headers: Record<string, string | string[] | undefined>,
    user?: { userId: string; externalId: string },
  ) {
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

        if (
          name !== "product.createManual" &&
          name !== "product.search" &&
          name !== "user.me" &&
          name !== "userProfile.upsert" &&
          name !== "userTargets.recalculate" &&
          name !== "recipeDraft.create" &&
          name !== "recipeDraft.addIngredient" &&
          name !== "recipeDraft.removeIngredient" &&
          name !== "recipeDraft.setSteps" &&
          name !== "recipeDraft.get" &&
          name !== "recipeDraft.validate" &&
          name !== "recipeDraft.publish" &&
          name !== "recipe.search" &&
          name !== "recipe.get"
        ) {
          return this.error(id, -32601, "Method not found");
        }

        try {
          if (name === "product.search") {
            const results = await this.mcpService.search(
              args as Record<string, unknown>,
            );
            const payload = formatSearchResult(results);
            // MCP CallToolResult content doesn't support type="json"; send JSON as text.
            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [jsonToTextContent(payload)],
                isError: false,
              },
            };
          }

          if (name === "product.createManual") {
            const product = await this.mcpService.createManual(
              args as Record<string, unknown>,
            );
            // MCP CallToolResult content doesn't support type="json"; send JSON as text.
            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  {
                    type: "text",
                    text: `✅ Product created: ${product.name}`,
                  },
                  jsonToTextContent(product),
                ],
                isError: false,
              },
            };
          }

          const userId =
            user?.userId ?? (await this.resolveUserId(headers));

          if (name === "user.me") {
            const data = await this.mcpService.userMe(userId);
            const payload = formatUserMe(data?.profile ?? null);
            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  { type: "text", text: "✅ User profile loaded" },
                  jsonToTextContent(payload),
                ],
                isError: false,
              },
            };
          }

          if (name === "userProfile.upsert") {
            const profile = await this.mcpService.upsertUserProfile(
              userId,
              args as Record<string, unknown>,
            );
            const summary = this.buildTargetsSummary(profile);
            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  { type: "text", text: summary },
                  jsonToTextContent({ profile }),
                ],
                isError: false,
              },
            };
          }

          if (name === "userTargets.recalculate") {
            const profile = await this.mcpService.recalculateTargets(userId);
            const summary = this.buildTargetsSummary(profile);
            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  { type: "text", text: summary },
                  jsonToTextContent({ profile }),
                ],
                isError: false,
              },
            };
          }

          if (name === "recipeDraft.create") {
            const payload = await this.mcpService.createRecipeDraft(
              args as Record<string, unknown>,
            );
            return this.jsonResult(id, "✅ Draft created", payload);
          }

          if (name === "recipeDraft.addIngredient") {
            const payload = await this.mcpService.addRecipeDraftIngredient(
              args as Record<string, unknown>,
            );
            return this.jsonResult(id, "✅ Ingredient added", payload);
          }

          if (name === "recipeDraft.removeIngredient") {
            const payload = await this.mcpService.removeRecipeDraftIngredient(
              args as Record<string, unknown>,
            );
            return this.jsonResult(id, "✅ Ingredient removed", payload);
          }

          if (name === "recipeDraft.setSteps") {
            const payload = await this.mcpService.setRecipeDraftSteps(
              args as Record<string, unknown>,
            );
            return this.jsonResult(id, "✅ Steps updated", payload);
          }

          if (name === "recipeDraft.get") {
            const payload = await this.mcpService.getRecipeDraft(
              args as Record<string, unknown>,
            );
            return this.jsonResult(id, "✅ Draft loaded", payload);
          }

          if (name === "recipeDraft.validate") {
            const payload = await this.mcpService.validateRecipeDraft(
              args as Record<string, unknown>,
            );
            return this.jsonResult(id, "✅ Draft validated", payload);
          }

          if (name === "recipeDraft.publish") {
            const payload = await this.mcpService.publishRecipeDraft(
              args as Record<string, unknown>,
            );
            return this.jsonResult(id, "✅ Draft published", payload);
          }

          if (name === "recipe.search") {
            const payload = await this.mcpService.searchRecipes(
              args as Record<string, unknown>,
            );
            return this.jsonResult(id, "✅ Recipes found", payload);
          }

          if (name === "recipe.get") {
            const payload = await this.mcpService.getRecipe(
              args as Record<string, unknown>,
            );
            return this.jsonResult(id, "✅ Recipe loaded", payload);
          }
        } catch (error) {
          if (error instanceof McpValidationError) {
            return this.error(id, -32600, "Invalid Request", {
              errors: error.errors,
            });
          }
          if (error instanceof MissingFieldsError) {
            return this.error(id, -32000, "Missing fields", {
              missingFields: error.missingFields,
            });
          }
          if (
            error instanceof RecipeDraftNotFoundError ||
            error instanceof RecipeNotFoundError
          ) {
            return this.error(id, -32000, "NOT_FOUND");
          }
          if (error instanceof DraftIncompleteError) {
            return this.error(id, -32000, "DRAFT_INCOMPLETE", {
              missingFields: error.missingFields,
              missingIngredients: error.missingIngredients,
            });
          }
          if (error instanceof UnauthorizedException) {
            throw error;
          }
          return this.error(id, -32000, "Server error");
        }
        return this.error(id, -32000, "Server error");
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

  private jsonResult(
    id: number | string | null,
    message: string,
    payload: unknown,
  ) {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [
          { type: "text", text: message },
          { type: "json", json: payload },
        ],
        isError: false,
      },
    };
  }

  private buildTargetsSummary(profile: {
    targetCalories: number | null;
    targetProteinG: number | null;
    targetFatG: number | null;
    targetCarbsG: number | null;
  } | null) {
    if (
      !profile ||
      profile.targetCalories == null ||
      profile.targetProteinG == null ||
      profile.targetFatG == null ||
      profile.targetCarbsG == null
    ) {
      return "✅ Profile saved.";
    }
    return `✅ Targets: ${profile.targetCalories} kcal, P ${profile.targetProteinG}g, F ${profile.targetFatG}g, C ${profile.targetCarbsG}g`;
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
