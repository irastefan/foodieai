import { Injectable } from "@nestjs/common";
import { Prisma, Product } from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validate, ValidationError } from "class-validator";
import { CreateProductDto } from "../products/dto/create-product.dto";
import { ProductsService } from "../products/products.service";
import { AddRecipeDraftIngredientDto } from "../recipes/dto/add-recipe-draft-ingredient.dto";
import { CreateRecipeDraftDto } from "../recipes/dto/create-recipe-draft.dto";
import { DraftIdDto } from "../recipes/dto/draft-id.dto";
import { RecipeIdDto } from "../recipes/dto/recipe-id.dto";
import { RemoveRecipeDraftIngredientDto } from "../recipes/dto/remove-recipe-draft-ingredient.dto";
import { SearchRecipesDto } from "../recipes/dto/search-recipes.dto";
import { SetRecipeDraftStepsDto } from "../recipes/dto/set-recipe-draft-steps.dto";
import { RecipeDraftsService } from "../recipes/recipe-drafts.service";
import { RecipesService } from "../recipes/recipes.service";
import { DraftIncompleteError, RecipeDraftNotFoundError, RecipeNotFoundError } from "../recipes/recipes.errors";
import { UpsertUserProfileDto } from "../users/dto/upsert-user-profile.dto";
import { UsersService } from "../users/users.service";
import { McpHandledError, throwMcpError } from "./mcp.utils";

export class McpValidationError extends Error {
  readonly errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    super("Validation failed");
    this.errors = errors;
  }
}

type JsonSchemaType = "string" | "number" | "object" | "array" | "boolean" | "null";

type JsonSchema = {
  type: JsonSchemaType | JsonSchemaType[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  additionalProperties?: boolean;
  enum?: Array<string | number | boolean | null>;
};

type ToolExample = { summary: string; arguments: Record<string, unknown> };
type ToolRpcExample = { summary: string; request: Record<string, unknown> };

type ToolDefinition = {
  name: string;
  description: string;
  tags: string[];
  auth: "none" | "required";
  public: boolean;
  inputSchema: JsonSchema;
  outputSchema?: JsonSchema;
  examples?: ToolExample[];
  rpcExamples?: ToolRpcExample[];
  dtoClass?: new () => object;
  handler: (
    args: Record<string, unknown>,
    context: { userId?: string; headers: Record<string, unknown>; requestId: string },
  ) => Promise<{ text: string; json?: unknown; meta?: Record<string, unknown> }>;
};

@Injectable()
export class McpService {
  constructor(
    private readonly productsService: ProductsService,
    private readonly recipeDraftsService: RecipeDraftsService,
    private readonly recipesService: RecipesService,
    private readonly usersService: UsersService,
  ) {
    this.toolRegistry = this.buildToolRegistry();
  }

  private readonly toolAliases: Record<string, string> = {
    "recipe.createDraft": "recipeDraft.create",
  };

  private readonly toolRegistry: Record<string, ToolDefinition>;

  private readonly recentCreates = new Map<
    string,
    { expiresAt: number; product: Product }
  >();

  // Tool catalog exposed via tools/list.

  listTools() {
    return Object.values(this.toolRegistry).map((tool) => ({
      name: tool.name,
      description: tool.description,
      tags: tool.tags,
      auth: tool.auth,
      public: tool.public,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      examples: tool.examples,
      rpcExamples: tool.rpcExamples,
    }));
  }

  getToolDefinition(name: string) {
    const resolved = this.resolveToolName(name);
    return resolved ? this.toolRegistry[resolved] : undefined;
  }

  async executeTool(
    name: string,
    rawArgs: Record<string, unknown>,
    context: { userId?: string; headers: Record<string, unknown>; requestId: string },
  ) {
    const resolvedName = this.resolveToolName(name);
    const tool = resolvedName ? this.toolRegistry[resolvedName] : undefined;
    if (!tool) {
      throwMcpError(-32601, "NOT_FOUND");
    }
    this.ensureAuth(tool, context);
    const validatedArgs = this.validateInput(tool, rawArgs);
    const args = await this.validateDtoIfPresent(tool, validatedArgs);
    const normalizedArgs = this.normalizeArgs(tool.name, args);
    return tool.handler(normalizedArgs, context);
  }

  private resolveToolName(name: string) {
    const canonical = this.toolAliases[name] ?? name;
    return this.toolRegistry[canonical] ? canonical : undefined;
  }

  private ensureAuth(
    tool: ToolDefinition,
    context: { userId?: string; headers: Record<string, unknown> },
  ) {
    if (tool.auth === "required" && !context.userId) {
      throwMcpError(401, "AUTH_REQUIRED");
    }
  }

  private validateInput(tool: ToolDefinition, args: Record<string, unknown>) {
    const errors: { path: string; expected: string; got: string }[] = [];
    if (!this.isPlainObject(args)) {
      throwMcpError(-32000, "VALIDATION_ERROR", {
        fields: [{ path: "", expected: "object", got: this.describeType(args) }],
        hint: "arguments must be an object",
      });
    }

    const value = this.coerceValue(tool.inputSchema, args, "", errors);
    if (errors.length > 0) {
      throwMcpError(-32000, "VALIDATION_ERROR", {
        fields: errors,
        hint: "Fix invalid fields and try again.",
      });
    }
    return value as Record<string, unknown>;
  }

  private coerceValue(
    schema: JsonSchema,
    value: unknown,
    path: string,
    errors: Array<{ path: string; expected: string; got: string }>,
  ): unknown {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];

    const isNullAllowed = types.includes("null");
    if (value === null) {
      if (isNullAllowed) {
        return null;
      }
      errors.push({ path, expected: types.join("|"), got: "null" });
      return null;
    }

    if (types.includes("number") && typeof value === "string" && value.trim().length > 0) {
      const num = Number(value);
      if (!Number.isNaN(num)) {
        value = num;
      }
    }

    if (types.includes("string") && typeof value === "number") {
      value = String(value);
    }

    if (types.includes("number") && typeof value === "number") {
      if (Number.isFinite(value)) {
        return value;
      }
      errors.push({ path, expected: "number", got: "non-finite number" });
      return value;
    }

    if (types.includes("string") && typeof value === "string") {
      const normalized = value.trim();
      if (schema.enum && !schema.enum.includes(normalized)) {
        errors.push({ path, expected: schema.enum.join("|"), got: normalized });
      }
      return normalized;
    }

    if (types.includes("boolean") && typeof value === "boolean") {
      return value;
    }

    if (types.includes("array") && Array.isArray(value) && schema.items) {
      return value.map((item, idx) =>
        this.coerceValue(schema.items as JsonSchema, item, `${path}[${idx}]`, errors),
      );
    }

    if (types.includes("object") && this.isPlainObject(value)) {
      const obj = value as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      const required = schema.required ?? [];
      if (schema.properties) {
        for (const key of Object.keys(schema.properties)) {
          const childSchema = schema.properties[key]!;
          if (obj[key] === undefined) {
            if (required.includes(key)) {
              errors.push({
                path: path ? `${path}.${key}` : key,
                expected: this.describeSchema(childSchema),
                got: "missing",
              });
            }
            continue;
          }
          result[key] = this.coerceValue(
            childSchema,
            obj[key],
            path ? `${path}.${key}` : key,
            errors,
          );
        }
      }
      const additionalProperties = schema.additionalProperties ?? true;
      if (additionalProperties === false) {
        return result;
      }
      for (const key of Object.keys(obj)) {
        if (!schema.properties || !(key in schema.properties)) {
          result[key] = obj[key];
        }
      }
      return result;
    }

    errors.push({ path, expected: types.join("|"), got: this.describeType(value) });
    return value;
  }

  private describeSchema(schema: JsonSchema) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    return types.join("|");
  }

  private describeType(value: unknown) {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private normalizeArgs(name: string, args: Record<string, unknown>) {
    if (name === "recipeDraft.addIngredient" && this.isPlainObject(args.ingredient)) {
      args.ingredient = this.normalizeIngredient(args.ingredient);
    }
    if (name === "recipe.search" || name === "product.search") {
      if (typeof args.limit === "number" && args.limit > 50) {
        args.limit = 50;
      }
    }
    return args;
  }

  private normalizeIngredient(ingredient: Record<string, unknown>) {
    const unitMap: Record<string, string> = {
      г: "g",
      гр: "g",
      грамм: "g",
      кг: "kg",
      ml: "ml",
      мл: "ml",
      л: "l",
      шт: "pcs",
    };
    if (typeof ingredient.unit === "string") {
      const key = ingredient.unit.toLowerCase();
      ingredient.unit = unitMap[key] ?? ingredient.unit;
    }
    if (typeof ingredient.name === "string") {
      ingredient.name = ingredient.name.trim();
    }
    return ingredient;
  }

  private async validateDtoIfPresent(
    tool: ToolDefinition,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!tool.dtoClass) {
      return args;
    }
    try {
      const dto = await this.validateDto(tool.dtoClass as new () => object, args);
      return dto as Record<string, unknown>;
    } catch (error) {
      if (error instanceof McpValidationError) {
        throwMcpError(-32000, "VALIDATION_ERROR", {
          fields: this.toValidationFields(error.errors),
          hint: "Fix invalid fields and try again.",
        });
      }
      throw error;
    }
  }

  private toValidationFields(errors: ValidationError[], parent = ""): Array<{
    path: string;
    expected: string;
    got: string;
  }> {
    const fields: Array<{ path: string; expected: string; got: string }> = [];
    for (const error of errors) {
      const path = parent ? `${parent}.${error.property}` : error.property;
      if (error.constraints) {
        const expected = Object.keys(error.constraints).join("|");
        fields.push({
          path,
          expected,
          got: this.describeType(error.value),
        });
      }
      if (error.children && error.children.length > 0) {
        fields.push(...this.toValidationFields(error.children, path));
      }
    }
    return fields;
  }

  private buildToolRegistry(): Record<string, ToolDefinition> {
    return {
      "mcp.capabilities": {
        name: "mcp.capabilities",
        description:
          "List MCP intents and related tools.\nUse to understand available flows.\nReturns grouping by intent.",
        tags: ["meta"],
        auth: "none",
        public: true,
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        outputSchema: { type: "object" },
        examples: [{ summary: "Load capabilities", arguments: {} }],
        rpcExamples: [
          {
            summary: "tools/call",
            request: {
              jsonrpc: "2.0",
              id: 1,
              method: "tools/call",
              params: { name: "mcp.capabilities", arguments: {} },
            },
          },
        ],
        handler: async (_args, context) => ({
          text: "✅ MCP capabilities",
          json: {
            toolsByIntent: {
              createRecipe: [
                "recipeDraft.create",
                "recipeDraft.addIngredient",
                "recipeDraft.setSteps",
                "recipeDraft.validate",
                "recipeDraft.publish",
              ],
              findRecipe: ["recipe.search", "recipe.get"],
              manageProducts: ["product.search", "product.createManual"],
            },
            flows: {
              recipe: ["create -> addIngredient* -> setSteps -> validate -> publish"],
            },
          },
          meta: { requestId: context.requestId },
        }),
      },
      "mcp.help": {
        name: "mcp.help",
        description:
          "Provide MCP usage hints.\nUse when unsure which tool to call.\nReturns markdown with examples.",
        tags: ["meta"],
        auth: "none",
        public: true,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            topic: { type: ["string", "null"], enum: ["recipes", "products", "auth", "all", null] },
          },
          required: [],
        },
        outputSchema: { type: "object" },
        examples: [
          { summary: "General help", arguments: {} },
          { summary: "Recipe-focused", arguments: { topic: "recipes" } },
        ],
        rpcExamples: [
          {
            summary: "tools/call",
            request: {
              jsonrpc: "2.0",
              id: 2,
              method: "tools/call",
              params: { name: "mcp.help", arguments: { topic: "recipes" } },
            },
          },
        ],
        handler: async (args, context) => {
          const topic = typeof args.topic === "string" ? args.topic : "all";
          const helpText =
            topic === "products"
              ? "Products:\n- Search products: recipe asks for ingredients with nutrition, call product.search\n- Create manual: when user provides nutrition per 100g, call product.createManual"
              : topic === "auth"
                ? "Auth:\n- user.me returns profile+targets\n- userProfile.upsert saves profile\n- userTargets.recalculate recalculates from profile"
                : "Recipes:\nFlow: recipeDraft.create -> addIngredient* -> setSteps -> validate -> publish\nUse recipe.search/get for published recipes.";
          const examples = {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: {
              name: "recipeDraft.addIngredient",
              arguments: {
                draftId: "draft_123",
                ingredient: { name: "Egg", amount: 2, unit: "pcs" },
              },
            },
          };
          return {
            text: "✅ Help",
            json: { topic, examples },
            meta: { requestId: context.requestId },
          };
        },
      },
      "product.createManual": {
        name: "product.createManual",
        description:
          "Create a product manually.\nUse when user provides nutrition per 100g.\nReturns productId and product.",
        tags: ["products"],
        auth: "none",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            brand: { type: ["string", "null"] },
            kcal100: { type: "number" },
            protein100: { type: "number" },
            fat100: { type: "number" },
            carbs100: { type: "number" },
          },
          required: ["name", "kcal100", "protein100", "fat100", "carbs100"],
        },
        outputSchema: {
          type: "object",
          properties: { productId: { type: "string" } },
          required: ["productId"],
        },
        examples: [
          {
            summary: "Create simple product",
            arguments: { name: "Salmon", kcal100: 208, protein100: 20, fat100: 13, carbs100: 0 },
          },
        ],
        rpcExamples: [
          {
            summary: "tools/call",
            request: {
              jsonrpc: "2.0",
              id: 10,
              method: "tools/call",
              params: {
                name: "product.createManual",
                arguments: { name: "Salmon", kcal100: 208, protein100: 20, fat100: 13, carbs100: 0 },
              },
            },
          },
        ],
        dtoClass: CreateProductDto,
        handler: async (args) => {
          const product = await this.createManual(args);
          return {
            text: `✅ Product created: ${product.name}`,
            json: { productId: product.id, product },
          };
        },
      },
      "product.search": {
        name: "product.search",
        description:
          "Search products by name/brand.\nUse when looking up nutrition for an ingredient.\nReturns list of products.",
        tags: ["products", "search"],
        auth: "none",
        public: true,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: { query: { type: ["string", "null"] } },
          required: [],
        },
        outputSchema: {
          type: "object",
          properties: {
            count: { type: "number" },
            items: { type: "array" },
          },
          required: ["count", "items"],
        },
        examples: [{ summary: "Search yogurt", arguments: { query: "yogurt" } }],
        rpcExamples: [
          {
            summary: "tools/call",
            request: {
              jsonrpc: "2.0",
              id: 11,
              method: "tools/call",
              params: { name: "product.search", arguments: { query: "yogurt" } },
            },
          },
        ],
        handler: async (args, context) => {
          const results = await this.search(args);
          return {
            text: `✅ Products found: ${results.length}`,
            json: { count: results.length, items: results },
            meta: { requestId: context.requestId },
          };
        },
      },
      "user.me": {
        name: "user.me",
        description:
          "Get current user profile and targets.\nUse when you need context about the user.\nReturns profile and targets.",
        tags: ["users"],
        auth: "required",
        public: false,
        inputSchema: { type: "object", additionalProperties: false, properties: {}, required: [] },
        outputSchema: { type: "object" },
        examples: [{ summary: "Current user", arguments: {} }],
        rpcExamples: [
          {
            summary: "tools/call",
            request: {
              jsonrpc: "2.0",
              id: 20,
              method: "tools/call",
              params: { name: "user.me", arguments: {} },
            },
          },
        ],
        handler: async (_args, context) => {
          const data = await this.userMe(context.userId as string);
          return {
            text: "✅ User profile loaded",
            json: { userId: context.userId, user: data },
          };
        },
      },
      "userProfile.upsert": {
        name: "userProfile.upsert",
        description:
          "Create or update user profile.\nUse when user provides personal data for targets.\nReturns saved profile.",
        tags: ["users"],
        auth: "required",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            firstName: { type: ["string", "null"] },
            lastName: { type: ["string", "null"] },
            sex: { type: ["string", "null"], enum: ["FEMALE", "MALE", null] },
            birthDate: { type: ["string", "null"] },
            heightCm: { type: ["number", "null"] },
            weightKg: { type: ["number", "null"] },
            activityLevel: {
              type: ["string", "null"],
              enum: ["SEDENTARY", "LIGHT", "MODERATE", "VERY_ACTIVE", null],
            },
            goal: { type: ["string", "null"], enum: ["MAINTAIN", "LOSE", "GAIN", null] },
            calorieDelta: { type: ["number", "null"] },
          },
          required: [],
        },
        outputSchema: { type: "object", properties: { profile: { type: "object" } } },
        examples: [
          {
            summary: "Set profile",
            arguments: {
              firstName: "Ira",
              sex: "FEMALE",
              heightCm: 168,
              weightKg: 63,
              activityLevel: "MODERATE",
              goal: "LOSE",
            },
          },
        ],
        rpcExamples: [
          {
            summary: "tools/call",
            request: {
              jsonrpc: "2.0",
              id: 21,
              method: "tools/call",
              params: {
                name: "userProfile.upsert",
                arguments: {
                  firstName: "Ira",
                  sex: "FEMALE",
                  heightCm: 168,
                  weightKg: 63,
                  activityLevel: "MODERATE",
                  goal: "LOSE",
                },
              },
            },
          },
        ],
        dtoClass: UpsertUserProfileDto,
        handler: async (args, context) => {
          const profile = await this.upsertUserProfile(context.userId as string, args);
          return {
            text: "✅ Profile saved",
            json: { profileId: profile?.id ?? null, profile },
          };
        },
      },
      "userTargets.recalculate": {
        name: "userTargets.recalculate",
        description:
          "Recalculate macro targets.\nUse after profile updates.\nReturns updated profile targets.",
        tags: ["users"],
        auth: "required",
        public: false,
        inputSchema: { type: "object", additionalProperties: false, properties: {}, required: [] },
        outputSchema: { type: "object" },
        examples: [{ summary: "Recalculate", arguments: {} }],
        rpcExamples: [
          {
            summary: "tools/call",
            request: {
              jsonrpc: "2.0",
              id: 22,
              method: "tools/call",
              params: { name: "userTargets.recalculate", arguments: {} },
            },
          },
        ],
        handler: async (_args, context) => {
          const profile = await this.recalculateTargets(context.userId as string);
          return {
            text: "✅ Targets recalculated",
            json: { profileId: profile?.id ?? null, profile },
          };
        },
      },
      "recipeDraft.create": {
        name: "recipeDraft.create",
        description:
          "Create a recipe draft.\nUse when starting a new recipe, even incomplete.\nReturns draftId.",
        tags: ["recipes", "drafts"],
        auth: "required",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            category: { type: ["string", "null"] },
            description: { type: ["string", "null"] },
            servings: { type: ["number", "null"] },
          },
          required: ["title"],
        },
        outputSchema: { type: "object", properties: { draftId: { type: "string" } } },
        examples: [{ summary: "Create draft", arguments: { title: "Omelette", category: "breakfast" } }],
        rpcExamples: [
          {
            summary: "tools/call",
            request: {
              jsonrpc: "2.0",
              id: 30,
              method: "tools/call",
              params: { name: "recipeDraft.create", arguments: { title: "Omelette", category: "breakfast" } },
            },
          },
        ],
        dtoClass: CreateRecipeDraftDto,
        handler: async (args) => {
          const draft = await this.recipeDraftsService.createDraft(
            args as unknown as CreateRecipeDraftDto,
          );
          return { text: "✅ Draft created", json: { draftId: draft.id, draft } };
        },
      },
      "recipeDraft.addIngredient": {
        name: "recipeDraft.addIngredient",
        description:
          "Add ingredient to draft.\nUse when user lists ingredients or quantities.\nReturns draft with ingredients.",
        tags: ["recipes", "drafts"],
        auth: "required",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            draftId: { type: "string" },
            clientRequestId: { type: ["string", "null"] },
            ingredient: {
              type: "object",
              additionalProperties: false,
              properties: {
                originalText: { type: ["string", "null"] },
                name: { type: "string" },
                amount: { type: ["number", "null"] },
                unit: { type: ["string", "null"] },
                productId: { type: ["string", "null"] },
                clientRequestId: { type: ["string", "null"] },
                macrosPer100: {
                  type: ["object", "null"],
                  additionalProperties: false,
                  properties: {
                    kcal100: { type: "number" },
                    protein100: { type: "number" },
                    fat100: { type: "number" },
                    carbs100: { type: "number" },
                  },
                  required: ["kcal100", "protein100", "fat100", "carbs100"],
                },
                assumptions: { type: ["object", "null"] },
                order: { type: ["number", "null"] },
              },
              required: ["name"],
            },
          },
          required: ["draftId", "ingredient"],
        },
        outputSchema: { type: "object" },
        examples: [
          {
            summary: "Add snapshot ingredient",
            arguments: {
              draftId: "draft_123",
              ingredient: {
                name: "Tomato",
                amount: 120,
                unit: "g",
                macrosPer100: { kcal100: 18, protein100: 0.9, fat100: 0.2, carbs100: 3.9 },
              },
            },
          },
        ],
        rpcExamples: [
          {
            summary: "tools/call",
            request: {
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
        ],
        dtoClass: AddRecipeDraftIngredientDto,
        handler: async (args) => {
          try {
            const draft = await this.recipeDraftsService.addIngredient(
              args.draftId as string,
              args.ingredient as AddRecipeDraftIngredientDto["ingredient"],
              (args.clientRequestId as string | null | undefined) ??
                (args.ingredient as AddRecipeDraftIngredientDto["ingredient"]).clientRequestId ??
                null,
            );
            return { text: "✅ Ingredient added", json: { draftId: draft.id, draft } };
          } catch (error) {
            if (error instanceof RecipeDraftNotFoundError) {
              throwMcpError(404, "NOT_FOUND");
            }
            throw error;
          }
        },
      },
      "recipeDraft.removeIngredient": {
        name: "recipeDraft.removeIngredient",
        description:
          "Remove ingredient from draft.\nUse to delete an ingredient.\nReturns remaining ingredients.",
        tags: ["recipes", "drafts"],
        auth: "required",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            draftId: { type: "string" },
            ingredientId: { type: "string" },
            clientRequestId: { type: ["string", "null"] },
          },
          required: ["draftId", "ingredientId"],
        },
        outputSchema: { type: "object" },
        examples: [{ summary: "Remove ingredient", arguments: { draftId: "draft_123", ingredientId: "ing_1" } }],
        rpcExamples: [
          {
            summary: "tools/call",
            request: {
              jsonrpc: "2.0",
              id: 32,
              method: "tools/call",
              params: {
                name: "recipeDraft.removeIngredient",
                arguments: { draftId: "draft_123", ingredientId: "ing_1" },
              },
            },
          },
        ],
        dtoClass: RemoveRecipeDraftIngredientDto,
        handler: async (args) => {
          try {
            const ingredients = await this.recipeDraftsService.removeIngredient(
              args.draftId as string,
              args.ingredientId as string,
              args.clientRequestId as string | null | undefined,
            );
            return {
              text: "✅ Ingredient removed",
              json: { draftId: args.draftId, ingredientId: args.ingredientId, ingredients },
            };
          } catch (error) {
            if (error instanceof RecipeDraftNotFoundError) {
              throwMcpError(404, "NOT_FOUND");
            }
            throw error;
          }
        },
      },
      "recipeDraft.setSteps": {
        name: "recipeDraft.setSteps",
        description:
          "Replace draft steps.\nUse after collecting ordered instructions.\nReturns updated steps.",
        tags: ["recipes", "drafts"],
        auth: "required",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            draftId: { type: "string" },
            steps: { type: "array", items: { type: "string" } },
            clientRequestId: { type: ["string", "null"] },
          },
          required: ["draftId", "steps"],
        },
        outputSchema: { type: "object" },
        examples: [
          {
            summary: "Set steps",
            arguments: { draftId: "draft_123", steps: ["Beat eggs", "Cook in pan", "Serve"] },
          },
        ],
        rpcExamples: [
          {
            summary: "tools/call",
            request: {
              jsonrpc: "2.0",
              id: 33,
              method: "tools/call",
              params: {
                name: "recipeDraft.setSteps",
                arguments: { draftId: "draft_123", steps: ["Beat eggs", "Cook in pan", "Serve"] },
              },
            },
          },
        ],
        dtoClass: SetRecipeDraftStepsDto,
        handler: async (args) => {
          try {
            const steps = await this.recipeDraftsService.setSteps(
              args.draftId as string,
              args.steps as string[],
              args.clientRequestId as string | null | undefined,
            );
            return { text: "✅ Steps updated", json: { draftId: args.draftId, steps } };
          } catch (error) {
            if (error instanceof RecipeDraftNotFoundError) {
              throwMcpError(404, "NOT_FOUND");
            }
            throw error;
          }
        },
      },
      "recipeDraft.get": {
        name: "recipeDraft.get",
        description:
          "Get draft by id.\nUse to inspect current ingredients/steps.\nReturns draft.",
        tags: ["recipes", "drafts"],
        auth: "required",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: { draftId: { type: "string" }, clientRequestId: { type: ["string", "null"] } },
          required: ["draftId"],
        },
        outputSchema: { type: "object" },
        examples: [{ summary: "Get draft", arguments: { draftId: "draft_123" } }],
        rpcExamples: [
          {
            summary: "tools/call",
            request: {
              jsonrpc: "2.0",
              id: 34,
              method: "tools/call",
              params: { name: "recipeDraft.get", arguments: { draftId: "draft_123" } },
            },
          },
        ],
        dtoClass: DraftIdDto,
        handler: async (args) => {
          try {
            const draft = await this.recipeDraftsService.getDraft(args.draftId as string);
            return { text: "✅ Draft loaded", json: { draftId: draft.id, draft } };
          } catch (error) {
            if (error instanceof RecipeDraftNotFoundError) {
              throwMcpError(404, "NOT_FOUND");
            }
            throw error;
          }
        },
      },
      "recipeDraft.validate": {
        name: "recipeDraft.validate",
        description:
          "Validate draft softly.\nUse before publish to find gaps.\nReturns validation result (no throw).",
        tags: ["recipes", "drafts"],
        auth: "required",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: { draftId: { type: "string" }, clientRequestId: { type: ["string", "null"] } },
          required: ["draftId"],
        },
        outputSchema: { type: "object" },
        examples: [{ summary: "Validate draft", arguments: { draftId: "draft_123" } }],
        rpcExamples: [
          {
            summary: "tools/call",
            request: {
              jsonrpc: "2.0",
              id: 35,
              method: "tools/call",
              params: { name: "recipeDraft.validate", arguments: { draftId: "draft_123" } },
            },
          },
        ],
        dtoClass: DraftIdDto,
        handler: async (args) => {
          try {
            const validation = await this.recipeDraftsService.validateDraft(args.draftId as string);
            return {
              text: validation.isValid ? "✅ Draft valid" : "⚠️ Draft incomplete",
              json: { draftId: args.draftId, ...validation },
              meta: validation.isValid
                ? { status: "VALID" }
                : { status: "INCOMPLETE", missingFields: validation.missingFields },
            };
          } catch (error) {
            if (error instanceof RecipeDraftNotFoundError) {
              throwMcpError(404, "NOT_FOUND");
            }
            throw error;
          }
        },
      },
      "recipeDraft.publish": {
        name: "recipeDraft.publish",
        description:
          "Publish draft into recipe.\nUse after validation passes.\nReturns recipeId.",
        tags: ["recipes", "drafts"],
        auth: "required",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: { draftId: { type: "string" } },
          required: ["draftId"],
        },
        outputSchema: { type: "object", properties: { recipeId: { type: "string" } } },
        examples: [{ summary: "Publish draft", arguments: { draftId: "draft_123" } }],
        rpcExamples: [
          {
            summary: "tools/call",
            request: {
              jsonrpc: "2.0",
              id: 36,
              method: "tools/call",
              params: { name: "recipeDraft.publish", arguments: { draftId: "draft_123" } },
            },
          },
        ],
        dtoClass: DraftIdDto,
        handler: async (args) => {
          try {
            const recipe = await this.recipeDraftsService.publishDraft(
              args.draftId as string,
              args.clientRequestId as string | null | undefined,
            );
            return {
              text: `✅ Draft published: ${recipe.title}`,
              json: { recipeId: recipe.id, title: recipe.title, recipe },
            };
          } catch (error) {
            if (error instanceof DraftIncompleteError) {
              throwMcpError(-32000, "DRAFT_INCOMPLETE", {
                missingFields: error.missingFields,
                missingIngredients: error.missingIngredients,
                nextActions: [
                  { askUser: "Provide productId or macrosPer100 for missing ingredients." },
                  {
                    callTool: "recipeDraft.addIngredient",
                    argumentsExample: {
                      draftId: args.draftId,
                      ingredient: {
                        name: "Ingredient name",
                        productId: "prod_123",
                        amount: 100,
                        unit: "g",
                      },
                    },
                  },
                ],
              });
            }
            if (error instanceof RecipeDraftNotFoundError) {
              throwMcpError(404, "NOT_FOUND");
            }
            throw error;
          }
        },
      },
      "recipe.search": {
        name: "recipe.search",
        description:
          "Search published recipes.\nUse when user asks for ideas or existing recipes.\nReturns recipe list.",
        tags: ["recipes"],
        auth: "none",
        public: true,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            query: { type: ["string", "null"] },
            category: { type: ["string", "null"] },
            limit: { type: ["number", "null"] },
          },
          required: [],
        },
        outputSchema: { type: "array", items: { type: "object" } },
        examples: [
          { summary: "Search breakfast", arguments: { query: "omelette", category: "breakfast", limit: 5 } },
        ],
        rpcExamples: [
          {
            summary: "tools/call",
            request: {
              jsonrpc: "2.0",
              id: 40,
              method: "tools/call",
              params: {
                name: "recipe.search",
                arguments: { query: "omelette", category: "breakfast", limit: 5 },
              },
            },
          },
        ],
        dtoClass: SearchRecipesDto,
        handler: async (args) => {
          const recipes = await this.searchRecipes(args);
          return {
            text: `✅ Recipes found: ${recipes.length}`,
            json: recipes,
          };
        },
      },
      "recipe.get": {
        name: "recipe.get",
        description:
          "Get recipe by id.\nUse after search or publish.\nReturns recipe with ingredients and steps.",
        tags: ["recipes"],
        auth: "none",
        public: true,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: { recipeId: { type: "string" } },
          required: ["recipeId"],
        },
        outputSchema: { type: "object" },
        examples: [{ summary: "Load recipe", arguments: { recipeId: "rec_123" } }],
        rpcExamples: [
          {
            summary: "tools/call",
            request: {
              jsonrpc: "2.0",
              id: 41,
              method: "tools/call",
              params: { name: "recipe.get", arguments: { recipeId: "rec_123" } },
            },
          },
        ],
        dtoClass: RecipeIdDto,
        handler: async (args) => {
          try {
            const recipe = await this.getRecipe(args);
            return {
              text: `✅ Recipe loaded: ${recipe.title}`,
              json: { recipeId: recipe.id, recipe },
            };
          } catch (error) {
            if (error instanceof RecipeNotFoundError) {
              throwMcpError(404, "NOT_FOUND");
            }
            throw error;
          }
        },
      },
    };
  }


  // MCP tool: product.createManual
  async createManual(args: Record<string, unknown>) {
    const dto = await this.validateDto(CreateProductDto, args);
    const signature = this.createSignature(dto);
    const cached = this.recentCreates.get(signature);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.product;
    }

    const product = await this.productsService.createManual(dto);
    this.recentCreates.set(signature, {
      expiresAt: Date.now() + 30_000,
      product,
    });
    return product;
  }

  // MCP tool: product.search
  async search(args: Record<string, unknown>) {
    const query = typeof args.query === "string" ? args.query : undefined;
    return this.productsService.search(query);
  }

  // MCP tool: user.me
  async userMe(userId: string) {
    return this.usersService.getUserWithProfile(userId);
  }

  // MCP tool: userProfile.upsert
  async upsertUserProfile(userId: string, args: Record<string, unknown>) {
    const dto = await this.validateDto(UpsertUserProfileDto, args);
    return this.usersService.upsertProfile(userId, dto);
  }

  // MCP tool: userTargets.recalculate
  async recalculateTargets(userId: string) {
    return this.usersService.recalculateTargets(userId);
  }

  async createRecipeDraft(args: Record<string, unknown>) {
    const dto = await this.validateDto(CreateRecipeDraftDto, args);
    const draft = await this.recipeDraftsService.createDraft(dto);
    return { draftId: draft.id, draft };
  }

  async addRecipeDraftIngredient(args: Record<string, unknown>) {
    const dto = await this.validateDto(AddRecipeDraftIngredientDto, args);
    const draft = await this.recipeDraftsService.addIngredient(
      dto.draftId,
      dto.ingredient,
    );
    return { draft };
  }

  async removeRecipeDraftIngredient(args: Record<string, unknown>) {
    const dto = await this.validateDto(RemoveRecipeDraftIngredientDto, args);
    const ingredients = await this.recipeDraftsService.removeIngredient(
      dto.draftId,
      dto.ingredientId,
    );
    return { ingredients };
  }

  async setRecipeDraftSteps(args: Record<string, unknown>) {
    const dto = await this.validateDto(SetRecipeDraftStepsDto, args);
    const steps = await this.recipeDraftsService.setSteps(dto.draftId, dto.steps);
    return { steps };
  }

  async getRecipeDraft(args: Record<string, unknown>) {
    const dto = await this.validateDto(DraftIdDto, args);
    const draft = await this.recipeDraftsService.getDraft(dto.draftId);
    return { draft };
  }

  async validateRecipeDraft(args: Record<string, unknown>) {
    const dto = await this.validateDto(DraftIdDto, args);
    return this.recipeDraftsService.validateDraft(dto.draftId);
  }

  async publishRecipeDraft(args: Record<string, unknown>) {
    const dto = await this.validateDto(DraftIdDto, args);
    const recipe = await this.recipeDraftsService.publishDraft(dto.draftId);
    return { recipeId: recipe.id, recipe };
  }

  async searchRecipes(args: Record<string, unknown>) {
    const dto = await this.validateDto(SearchRecipesDto, args);
    return this.recipesService.search(dto.query, dto.category, dto.limit);
  }

  async getRecipe(args: Record<string, unknown>) {
    const dto = await this.validateDto(RecipeIdDto, args);
    return this.recipesService.get(dto.recipeId);
  }

  // Shared DTO validation for MCP tool args.
  private async validateDto<T extends object>(
    dtoClass: new () => T,
    payload: Record<string, unknown> | undefined,
  ): Promise<T> {
    const dto = plainToInstance(dtoClass, payload ?? {}, {
      enableImplicitConversion: true,
    });
    const errors = await validate(dto as object, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      throw new McpValidationError(errors);
    }
    return dto;
  }

  private createSignature(dto: CreateProductDto) {
    return JSON.stringify({
      name: dto.name,
      brand: dto.brand ?? null,
      kcal100: dto.kcal100,
      protein100: dto.protein100,
      fat100: dto.fat100,
      carbs100: dto.carbs100,
    });
  }
}
