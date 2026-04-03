import { Injectable, NotFoundException } from "@nestjs/common";
import { Product } from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validate, ValidationError } from "class-validator";
import { AddMealPlanEntryDto } from "../meal-plans/dto/add-meal-plan-entry.dto";
import { GetMealPlanDayDto } from "../meal-plans/dto/get-meal-plan-day.dto";
import { GetMealPlanHistoryDto } from "../meal-plans/dto/get-meal-plan-history.dto";
import { RemoveMealPlanEntryDto } from "../meal-plans/dto/remove-meal-plan-entry.dto";
import { MealPlansService } from "../meal-plans/meal-plans.service";
import { CreateProductDto } from "../products/dto/create-product.dto";
import { ProductsService } from "../products/products.service";
import { CreateRecipeDto } from "../recipes/dto/create-recipe.dto";
import { RecipeIdDto } from "../recipes/dto/recipe-id.dto";
import { SearchRecipesDto } from "../recipes/dto/search-recipes.dto";
import { RecipesService } from "../recipes/recipes.service";
import { CreateSelfCareItemDto } from "../self-care-routines/dto/create-self-care-item.dto";
import { CreateSelfCareSlotDto } from "../self-care-routines/dto/create-self-care-slot.dto";
import { SelfCareItemIdDto } from "../self-care-routines/dto/self-care-item-id.dto";
import { SelfCareSlotIdDto } from "../self-care-routines/dto/self-care-slot-id.dto";
import { UpdateSelfCareItemDto } from "../self-care-routines/dto/update-self-care-item.dto";
import { UpdateSelfCareSlotDto } from "../self-care-routines/dto/update-self-care-slot.dto";
import { SelfCareRoutinesService } from "../self-care-routines/self-care-routines.service";
import { AddShoppingCategoryDto } from "../shopping-list/dto/add-shopping-category.dto";
import { AddShoppingItemDto, SetShoppingItemStateDto } from "../shopping-list/dto/add-shopping-item.dto";
import { ShoppingItemIdDto } from "../shopping-list/dto/item-id.dto";
import { ShoppingListService } from "../shopping-list/shopping-list.service";
import { GetBodyMetricsDayDto } from "../users/dto/get-body-metrics-day.dto";
import { GetBodyMetricsHistoryDto } from "../users/dto/get-body-metrics-history.dto";
import { UpsertUserProfileDto } from "../users/dto/upsert-user-profile.dto";
import { UpsertBodyMetricsDto } from "../users/dto/upsert-body-metrics.dto";
import { UsersService } from "../users/users.service";
import { throwMcpError } from "./mcp.utils";

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
    private readonly recipesService: RecipesService,
    private readonly mealPlansService: MealPlansService,
    private readonly selfCareRoutinesService: SelfCareRoutinesService,
    private readonly shoppingListService: ShoppingListService,
    private readonly usersService: UsersService,
  ) {
    this.toolRegistry = this.buildToolRegistry();
  }

  private readonly toolRegistry: Record<string, ToolDefinition>;

  private readonly recentCreates = new Map<string, { expiresAt: number; product: Product }>();

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
    return this.toolRegistry[name];
  }

  async executeTool(
    name: string,
    rawArgs: Record<string, unknown>,
    context: { userId?: string; headers: Record<string, unknown>; requestId: string },
  ) {
    const tool = this.toolRegistry[name];
    if (!tool) {
      throwMcpError(-32601, "NOT_FOUND");
    }
    this.ensureAuth(tool, context);
    const validatedArgs = this.validateInput(tool, rawArgs);
    const args = await this.validateDtoIfPresent(tool, validatedArgs);
    const normalizedArgs = this.normalizeArgs(tool.name, args);
    return tool.handler(normalizedArgs, context);
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
    if (name === "recipe.create" && Array.isArray(args.ingredients)) {
      args.ingredients = args.ingredients.map((ingredient) =>
        this.isPlainObject(ingredient) ? this.normalizeIngredient(ingredient) : ingredient,
      );
    }
    if (name === "recipe.search" || name === "product.search") {
      if (typeof args.limit === "number" && args.limit > 50) {
        args.limit = 50;
      }
    }
    if (name === "mealPlan.addEntry") {
      if (typeof args.slot === "string") {
        args.slot = args.slot.trim().toUpperCase();
      }
      if (typeof args.unit === "string") {
        args.unit = args.unit.trim().toLowerCase();
      }
    }
    if (name === "shoppingList.addItem") {
      if (typeof args.unit === "string") {
        args.unit = args.unit.trim().toLowerCase();
      }
      if (typeof args.categoryName === "string") {
        args.categoryName = args.categoryName.trim();
      }
      if (typeof args.customName === "string") {
        args.customName = args.customName.trim();
      }
    }
    if (name.startsWith("selfCare.")) {
      if (typeof args.weekday === "string") {
        args.weekday = args.weekday.trim().toUpperCase();
      }
      if (typeof args.name === "string") {
        args.name = args.name.trim();
      }
      if (typeof args.title === "string") {
        args.title = args.title.trim();
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
              createRecipe: ["recipe.create"],
              findRecipe: ["recipe.search", "recipe.get"],
              manageProducts: ["product.search", "product.createManual"],
              planMeals: ["mealPlan.dayGet", "mealPlan.historyGet", "mealPlan.addEntry", "mealPlan.removeEntry"],
              selfCare: [
                "selfCare.weekGet",
                "selfCare.slotCreate",
                "selfCare.slotUpdate",
                "selfCare.slotRemove",
                "selfCare.itemCreate",
                "selfCare.itemUpdate",
                "selfCare.itemRemove",
              ],
              trackBodyMetrics: ["bodyMetrics.dayGet", "bodyMetrics.upsertDaily", "bodyMetrics.historyGet"],
              shopping: [
                "shoppingList.get",
                "shoppingList.addCategory",
                "shoppingList.addItem",
                "shoppingList.setItemState",
                "shoppingList.removeItem",
              ],
            },
            flows: {
              recipe: ["create -> get"],
              mealPlan: ["dayGet -> addEntry* -> dayGet"],
              selfCare: ["weekGet -> slotCreate* -> itemCreate* -> itemUpdate/itemRemove"],
              shoppingList: ["addCategory* -> addItem* -> setItemState/removeItem"],
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
            topic: {
              type: ["string", "null"],
              enum: ["recipes", "products", "users", "meal-plans", "self-care", "shopping-list", "all", null],
            },
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
              ? "Products:\n- Search products before recipe creation: product.search\n- Add manual product with macros: product.createManual"
              : topic === "meal-plans"
                ? "Meal plans:\n- Get day plan: mealPlan.dayGet\n- Get add history: mealPlan.historyGet\n- Add product or recipe into slot: mealPlan.addEntry\n- Remove entry: mealPlan.removeEntry"
                : topic === "self-care"
                ? "Self-care routines:\n- Get full week: selfCare.weekGet\n- Create/update/delete slots: selfCare.slotCreate / selfCare.slotUpdate / selfCare.slotRemove\n- Create/update/delete items: selfCare.itemCreate / selfCare.itemUpdate / selfCare.itemRemove"
                : topic === "shopping-list"
                ? "Shopping list:\n- Read list: shoppingList.get\n- Add category: shoppingList.addCategory\n- Add item (productId or customName): shoppingList.addItem"
              : topic === "users"
                ? "Users:\n- user.me returns profile\n- userProfile.upsert saves profile\n- userTargets.recalculate recalculates targets\n- bodyMetrics.upsertDaily saves daily weight/measurements\n- bodyMetrics.dayGet/bodyMetrics.historyGet read them"
                : "Recipes:\n- Create in one call with product-linked ingredients: recipe.create\n- Then use recipe.search / recipe.get.";
          const examples = {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: {
              name: "recipe.create",
              arguments: {
                title: "Omelette",
                ingredients: [{ productId: "prod_egg", amount: 120, unit: "g" }],
                steps: ["Beat eggs", "Cook"],
              },
            },
          };
          return {
            text: "✅ Help",
            json: { topic, helpText, examples },
            meta: { requestId: context.requestId },
          };
        },
      },
      "product.createManual": {
        name: "product.createManual",
        description:
          "Create a product manually.\nUse when user provides nutrition per 100g.\nReturns productId and product.",
        tags: ["products"],
        auth: "required",
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
            isPublic: { type: "boolean" },
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
        handler: async (args, context) => {
          const product = await this.createManual(context.userId as string, args);
          return {
            text: `✅ Product created: ${product.name}`,
            json: { productId: product.id, product },
          };
        },
      },
      "product.search": {
        name: "product.search",
        description:
          "Search products by name/brand.\nReturns public products, plus your own private products when authenticated.",
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
          const results = await this.search(context.userId, args);
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
      "bodyMetrics.dayGet": {
        name: "bodyMetrics.dayGet",
        description:
          "Get daily body metrics.\nUse to inspect weight and body measurements for a day.\nReturns entry or null.",
        tags: ["users", "body-metrics"],
        auth: "required",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: { date: { type: ["string", "null"] } },
          required: [],
        },
        outputSchema: { type: ["object", "null"] },
        examples: [{ summary: "Today body metrics", arguments: {} }],
        rpcExamples: [
          {
            summary: "tools/call",
            request: {
              jsonrpc: "2.0",
              id: 23,
              method: "tools/call",
              params: { name: "bodyMetrics.dayGet", arguments: { date: "2026-03-26" } },
            },
          },
        ],
        dtoClass: GetBodyMetricsDayDto,
        handler: async (args, context) => {
          const entry = await this.getBodyMetricsDay(context.userId as string, args);
          return {
            text: entry ? "✅ Body metrics loaded" : "✅ No body metrics for date",
            json: entry,
          };
        },
      },
      "bodyMetrics.upsertDaily": {
        name: "bodyMetrics.upsertDaily",
        description:
          "Create or update daily weight and body measurements.\nUse for progress tracking.\nReturns saved daily entry.",
        tags: ["users", "body-metrics"],
        auth: "required",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            date: { type: ["string", "null"] },
            weightKg: { type: ["number", "null"] },
            neckCm: { type: ["number", "null"] },
            bustCm: { type: ["number", "null"] },
            underbustCm: { type: ["number", "null"] },
            waistCm: { type: ["number", "null"] },
            hipsCm: { type: ["number", "null"] },
            bicepsCm: { type: ["number", "null"] },
            forearmCm: { type: ["number", "null"] },
            thighCm: { type: ["number", "null"] },
            calfCm: { type: ["number", "null"] },
          },
          required: [],
        },
        outputSchema: { type: "object" },
        examples: [
          {
            summary: "Weight only",
            arguments: { date: "2026-03-26", weightKg: 62.4 },
          },
          {
            summary: "Weight and measurements",
            arguments: { date: "2026-03-26", weightKg: 62.4, waistCm: 68, hipsCm: 95, thighCm: 54 },
          },
        ],
        rpcExamples: [
          {
            summary: "tools/call",
            request: {
              jsonrpc: "2.0",
              id: 231,
              method: "tools/call",
              params: {
                name: "bodyMetrics.upsertDaily",
                arguments: { date: "2026-03-26", weightKg: 62.4, waistCm: 68 },
              },
            },
          },
        ],
        dtoClass: UpsertBodyMetricsDto,
        handler: async (args, context) => {
          const entry = await this.upsertBodyMetrics(context.userId as string, args);
          return {
            text: "✅ Body metrics saved",
            json: entry,
          };
        },
      },
      "bodyMetrics.historyGet": {
        name: "bodyMetrics.historyGet",
        description:
          "Get body metrics history for a date range.\nUse to plot progress over time.\nReturns daily entries sorted by date descending.",
        tags: ["users", "body-metrics"],
        auth: "required",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            fromDate: { type: ["string", "null"] },
            toDate: { type: ["string", "null"] },
            limitDays: { type: ["number", "null"] },
          },
          required: [],
        },
        outputSchema: { type: "object" },
        examples: [
          { summary: "Last 30 days", arguments: {} },
          { summary: "Custom range", arguments: { fromDate: "2026-03-01", toDate: "2026-03-26" } },
        ],
        rpcExamples: [
          {
            summary: "tools/call",
            request: {
              jsonrpc: "2.0",
              id: 232,
              method: "tools/call",
              params: { name: "bodyMetrics.historyGet", arguments: { fromDate: "2026-03-01", toDate: "2026-03-26" } },
            },
          },
        ],
        dtoClass: GetBodyMetricsHistoryDto,
        handler: async (args, context) => {
          const history = await this.getBodyMetricsHistory(context.userId as string, args);
          return {
            text: "✅ Body metrics history loaded",
            json: history,
          };
        },
      },
      "mealPlan.dayGet": {
        name: "mealPlan.dayGet",
        description:
          "Get day meal plan with K/B/Zh/U by slots and total.\nUse to inspect current daily plan.\nReturns day object.",
        tags: ["meal-plans"],
        auth: "required",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: { date: { type: ["string", "null"] } },
          required: [],
        },
        outputSchema: { type: "object" },
        examples: [{ summary: "Today plan", arguments: {} }],
        rpcExamples: [
          {
            summary: "tools/call",
            request: {
              jsonrpc: "2.0",
              id: 24,
              method: "tools/call",
              params: { name: "mealPlan.dayGet", arguments: { date: "2026-02-20" } },
            },
          },
        ],
        dtoClass: GetMealPlanDayDto,
        handler: async (args, context) => {
          const day = await this.getMealPlanDay(context.userId as string, args);
          return {
            text: "✅ Meal plan loaded",
            json: day,
          };
        },
      },
      "mealPlan.historyGet": {
        name: "mealPlan.historyGet",
        description:
          "Get unique meal plan add history for the last 30 days up to a selected date.\nUse to suggest recently added foods.\nReturns items sorted by added time descending.",
        tags: ["meal-plans"],
        auth: "required",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: { date: { type: ["string", "null"] } },
          required: [],
        },
        outputSchema: { type: "object" },
        examples: [{ summary: "Recent meal plan items", arguments: {} }],
        rpcExamples: [
          {
            summary: "tools/call",
            request: {
              jsonrpc: "2.0",
              id: 241,
              method: "tools/call",
              params: { name: "mealPlan.historyGet", arguments: { date: "2026-02-20" } },
            },
          },
        ],
        dtoClass: GetMealPlanHistoryDto,
        handler: async (args, context) => {
          const history = await this.getMealPlanHistory(context.userId as string, args);
          return {
            text: "✅ Meal plan history loaded",
            json: history,
          };
        },
      },
      "mealPlan.addEntry": {
        name: "mealPlan.addEntry",
        description:
          "Add product, recipe, or manual item to a meal slot.\nUse for breakfast/lunch/dinner/snack planning.\nReturns recalculated day plan.",
        tags: ["meal-plans"],
        auth: "required",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            date: { type: ["string", "null"] },
            slot: { type: "string", enum: ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] },
            productId: { type: ["string", "null"] },
            recipeId: { type: ["string", "null"] },
            name: { type: ["string", "null"] },
            amount: { type: ["number", "null"] },
            unit: { type: ["string", "null"] },
            servings: { type: ["number", "null"] },
            kcal100: { type: ["number", "null"] },
            protein100: { type: ["number", "null"] },
            fat100: { type: ["number", "null"] },
            carbs100: { type: ["number", "null"] },
          },
          required: ["slot"],
        },
        outputSchema: { type: "object" },
        examples: [
          {
            summary: "Add product to breakfast",
            arguments: {
              slot: "BREAKFAST",
              productId: "prod_123",
              amount: 150,
              unit: "g",
            },
          },
          {
            summary: "Add recipe to dinner",
            arguments: {
              slot: "DINNER",
              recipeId: "rec_123",
              servings: 1,
            },
          },
          {
            summary: "Add manual item",
            arguments: {
              slot: "SNACK",
              name: "Homemade yogurt",
              amount: 180,
              unit: "g",
              kcal100: 63,
              protein100: 5.2,
              fat100: 3.1,
              carbs100: 7.4,
            },
          },
        ],
        rpcExamples: [
          {
            summary: "tools/call",
            request: {
              jsonrpc: "2.0",
              id: 25,
              method: "tools/call",
              params: {
                name: "mealPlan.addEntry",
                arguments: { slot: "SNACK", productId: "prod_123", amount: 100, unit: "g" },
              },
            },
          },
        ],
        dtoClass: AddMealPlanEntryDto,
        handler: async (args, context) => {
          const day = await this.addMealPlanEntry(context.userId as string, args);
          return {
            text: "✅ Meal plan updated",
            json: day,
          };
        },
      },
      "mealPlan.removeEntry": {
        name: "mealPlan.removeEntry",
        description:
          "Remove item from day meal plan.\nUse when user deletes a meal item.\nReturns recalculated day plan.",
        tags: ["meal-plans"],
        auth: "required",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: { entryId: { type: "string" } },
          required: ["entryId"],
        },
        outputSchema: { type: "object" },
        examples: [{ summary: "Remove entry", arguments: { entryId: "entry_123" } }],
        rpcExamples: [
          {
            summary: "tools/call",
            request: {
              jsonrpc: "2.0",
              id: 26,
              method: "tools/call",
              params: { name: "mealPlan.removeEntry", arguments: { entryId: "entry_123" } },
            },
          },
        ],
        dtoClass: RemoveMealPlanEntryDto,
        handler: async (args, context) => {
          const day = await this.removeMealPlanEntry(context.userId as string, args);
          return {
            text: "✅ Entry removed",
            json: day,
          };
        },
      },
      "selfCare.weekGet": {
        name: "selfCare.weekGet",
        description:
          "Get weekly repeating self-care routine.\nUse to load all 7 weekdays with ordered slots and items.\nReturns week object.",
        tags: ["self-care"],
        auth: "required",
        public: false,
        inputSchema: { type: "object", additionalProperties: false, properties: {}, required: [] },
        outputSchema: { type: "object" },
        examples: [{ summary: "Get weekly routine", arguments: {} }],
        rpcExamples: [
          {
            summary: "tools/call",
            request: {
              jsonrpc: "2.0",
              id: 70,
              method: "tools/call",
              params: { name: "selfCare.weekGet", arguments: {} },
            },
          },
        ],
        handler: async (_args, context) => {
          const week = await this.getSelfCareWeek(context.userId as string);
          return {
            text: "✅ Self-care routine loaded",
            json: week,
          };
        },
      },
      "selfCare.slotCreate": {
        name: "selfCare.slotCreate",
        description:
          "Create self-care slot for a weekday.\nUse for morning, evening, or custom slots.\nReturns updated weekly routine.",
        tags: ["self-care"],
        auth: "required",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            weekday: { type: "string", enum: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] },
            name: { type: "string" },
            order: { type: ["number", "null"] },
          },
          required: ["weekday", "name"],
        },
        outputSchema: { type: "object" },
        examples: [{ summary: "Create morning slot", arguments: { weekday: "MONDAY", name: "Morning", order: 1 } }],
        dtoClass: CreateSelfCareSlotDto,
        handler: async (args, context) => {
          const week = await this.createSelfCareSlot(context.userId as string, args);
          return {
            text: "✅ Self-care slot created",
            json: week,
          };
        },
      },
      "selfCare.slotUpdate": {
        name: "selfCare.slotUpdate",
        description:
          "Update self-care slot.\nUse to rename or move a slot to another weekday/order.\nReturns updated weekly routine.",
        tags: ["self-care"],
        auth: "required",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            slotId: { type: "string" },
            weekday: { type: ["string", "null"], enum: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY", null] },
            name: { type: ["string", "null"] },
            order: { type: ["number", "null"] },
          },
          required: ["slotId"],
        },
        outputSchema: { type: "object" },
        examples: [{ summary: "Rename slot", arguments: { slotId: "slot_123", name: "Evening" } }],
        handler: async (args, context) => {
          const week = await this.updateSelfCareSlot(context.userId as string, args);
          return {
            text: "✅ Self-care slot updated",
            json: week,
          };
        },
      },
      "selfCare.slotRemove": {
        name: "selfCare.slotRemove",
        description:
          "Delete self-care slot.\nUse when user removes a routine block.\nReturns updated weekly routine.",
        tags: ["self-care"],
        auth: "required",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: { slotId: { type: "string" } },
          required: ["slotId"],
        },
        outputSchema: { type: "object" },
        examples: [{ summary: "Remove slot", arguments: { slotId: "slot_123" } }],
        dtoClass: SelfCareSlotIdDto,
        handler: async (args, context) => {
          const week = await this.removeSelfCareSlot(context.userId as string, args);
          return {
            text: "✅ Self-care slot removed",
            json: week,
          };
        },
      },
      "selfCare.itemCreate": {
        name: "selfCare.itemCreate",
        description:
          "Create self-care item inside a slot.\nUse for cleanser, serum, mask, microcurrent, and notes.\nReturns updated weekly routine.",
        tags: ["self-care"],
        auth: "required",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            slotId: { type: "string" },
            title: { type: "string" },
            description: { type: ["string", "null"] },
            note: { type: ["string", "null"] },
            order: { type: ["number", "null"] },
          },
          required: ["slotId", "title"],
        },
        outputSchema: { type: "object" },
        examples: [{ summary: "Add serum", arguments: { slotId: "slot_123", title: "Vitamin C serum", order: 2 } }],
        handler: async (args, context) => {
          const week = await this.createSelfCareItem(context.userId as string, args);
          return {
            text: "✅ Self-care item created",
            json: week,
          };
        },
      },
      "selfCare.itemUpdate": {
        name: "selfCare.itemUpdate",
        description:
          "Update self-care item.\nUse to edit title, description, note, or order.\nReturns updated weekly routine.",
        tags: ["self-care"],
        auth: "required",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            itemId: { type: "string" },
            title: { type: ["string", "null"] },
            description: { type: ["string", "null"] },
            note: { type: ["string", "null"] },
            order: { type: ["number", "null"] },
          },
          required: ["itemId"],
        },
        outputSchema: { type: "object" },
        examples: [{ summary: "Update note", arguments: { itemId: "item_123", note: "Use twice a week" } }],
        handler: async (args, context) => {
          const week = await this.updateSelfCareItem(context.userId as string, args);
          return {
            text: "✅ Self-care item updated",
            json: week,
          };
        },
      },
      "selfCare.itemRemove": {
        name: "selfCare.itemRemove",
        description:
          "Delete self-care item.\nUse when user removes a procedure from a slot.\nReturns updated weekly routine.",
        tags: ["self-care"],
        auth: "required",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: { itemId: { type: "string" } },
          required: ["itemId"],
        },
        outputSchema: { type: "object" },
        examples: [{ summary: "Remove item", arguments: { itemId: "item_123" } }],
        dtoClass: SelfCareItemIdDto,
        handler: async (args, context) => {
          const week = await this.removeSelfCareItem(context.userId as string, args);
          return {
            text: "✅ Self-care item removed",
            json: week,
          };
        },
      },
      "shoppingList.get": {
        name: "shoppingList.get",
        description:
          "Get current shopping list.\nUse to show items and categories.\nReturns shopping list object.",
        tags: ["shopping-list"],
        auth: "required",
        public: false,
        inputSchema: { type: "object", additionalProperties: false, properties: {}, required: [] },
        outputSchema: { type: "object" },
        examples: [{ summary: "Get list", arguments: {} }],
        rpcExamples: [
          {
            summary: "tools/call",
            request: {
              jsonrpc: "2.0",
              id: 60,
              method: "tools/call",
              params: { name: "shoppingList.get", arguments: {} },
            },
          },
        ],
        handler: async (_args, context) => {
          const list = await this.getShoppingList(context.userId as string);
          return {
            text: "✅ Shopping list loaded",
            json: list,
          };
        },
      },
      "shoppingList.addCategory": {
        name: "shoppingList.addCategory",
        description:
          "Add shopping category.\nUse to create category like Dairy, Fruits.\nReturns category.",
        tags: ["shopping-list"],
        auth: "required",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: { name: { type: "string" } },
          required: ["name"],
        },
        outputSchema: { type: "object" },
        examples: [{ summary: "Add category", arguments: { name: "Dairy" } }],
        dtoClass: AddShoppingCategoryDto,
        handler: async (args, context) => {
          const category = await this.addShoppingCategory(context.userId as string, args);
          return {
            text: "✅ Category added",
            json: category,
          };
        },
      },
      "shoppingList.addItem": {
        name: "shoppingList.addItem",
        description:
          "Add shopping item by productId or free text.\nUse with optional categoryId/categoryName.\nReturns updated shopping list.",
        tags: ["shopping-list"],
        auth: "required",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            productId: { type: ["string", "null"] },
            customName: { type: ["string", "null"] },
            amount: { type: ["number", "null"] },
            unit: { type: ["string", "null"] },
            note: { type: ["string", "null"] },
            categoryId: { type: ["string", "null"] },
            categoryName: { type: ["string", "null"] },
          },
          required: [],
        },
        outputSchema: { type: "object" },
        examples: [
          { summary: "Add product item", arguments: { productId: "prod_123", amount: 2, unit: "pcs" } },
          { summary: "Add free text item", arguments: { customName: "Paper towels", categoryName: "Home" } },
        ],
        dtoClass: AddShoppingItemDto,
        handler: async (args, context) => {
          const list = await this.addShoppingItem(context.userId as string, args);
          return {
            text: "✅ Item added",
            json: list,
          };
        },
      },
      "shoppingList.setItemState": {
        name: "shoppingList.setItemState",
        description:
          "Set shopping item done/undone.\nUse when user marks checkbox.\nReturns updated shopping list.",
        tags: ["shopping-list"],
        auth: "required",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            itemId: { type: "string" },
            isDone: { type: "boolean" },
          },
          required: ["itemId", "isDone"],
        },
        outputSchema: { type: "object" },
        examples: [{ summary: "Mark as done", arguments: { itemId: "item_123", isDone: true } }],
        dtoClass: SetShoppingItemStateDto,
        handler: async (args, context) => {
          const list = await this.setShoppingItemState(context.userId as string, args);
          return {
            text: "✅ Item state updated",
            json: list,
          };
        },
      },
      "shoppingList.removeItem": {
        name: "shoppingList.removeItem",
        description:
          "Remove shopping item.\nUse when user deletes an item.\nReturns updated shopping list.",
        tags: ["shopping-list"],
        auth: "required",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: { itemId: { type: "string" } },
          required: ["itemId"],
        },
        outputSchema: { type: "object" },
        examples: [{ summary: "Remove item", arguments: { itemId: "item_123" } }],
        dtoClass: ShoppingItemIdDto,
        handler: async (args, context) => {
          const list = await this.removeShoppingItem(context.userId as string, args);
          return {
            text: "✅ Item removed",
            json: list,
          };
        },
      },
      "recipe.create": {
        name: "recipe.create",
        description:
          "Create a recipe in one call.\nUse product-linked ingredients only.\nReturns recipeId and recipe.",
        tags: ["recipes"],
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
            isPublic: { type: "boolean" },
            ingredients: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  productId: { type: ["string", "null"] },
                  name: { type: ["string", "null"] },
                  amount: { type: "number" },
                  unit: { type: "string" },
                  kcal100: { type: ["number", "null"] },
                  protein100: { type: ["number", "null"] },
                  fat100: { type: ["number", "null"] },
                  carbs100: { type: ["number", "null"] },
                },
                required: ["amount", "unit"],
              },
            },
            steps: { type: "array", items: { type: "string" } },
          },
          required: ["title", "ingredients", "steps"],
        },
        outputSchema: { type: "object", properties: { recipeId: { type: "string" } } },
        examples: [
          {
            summary: "Create recipe",
            arguments: {
              title: "Omelette",
              servings: 2,
              ingredients: [
                { productId: "prod_egg", amount: 120, unit: "g" },
                { productId: "prod_butter", amount: 10, unit: "g" },
              ],
              steps: ["Beat eggs", "Cook", "Serve"],
            },
          },
          {
            summary: "Create recipe with manual ingredient",
            arguments: {
              title: "Protein bowl",
              ingredients: [
                { name: "Homemade yogurt", amount: 200, unit: "g", kcal100: 63, protein100: 5.2, fat100: 3.1, carbs100: 7.4 },
              ],
              steps: ["Mix", "Serve"],
            },
          },
        ],
        rpcExamples: [
          {
            summary: "tools/call",
            request: {
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
        ],
        dtoClass: CreateRecipeDto,
        handler: async (args, context) => {
          const recipe = await this.createRecipe(context.userId as string, args);
          return {
            text: `✅ Recipe created: ${recipe.title}`,
            json: { recipeId: recipe.id, recipe },
          };
        },
      },
      "recipe.search": {
        name: "recipe.search",
        description:
          "Search recipes.\nReturns public recipes, plus your private recipes when authenticated.",
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
        handler: async (args, context) => {
          const recipes = await this.searchRecipes(context.userId, args);
          return {
            text: `✅ Recipes found: ${recipes.length}`,
            json: recipes,
          };
        },
      },
      "recipe.get": {
        name: "recipe.get",
        description:
          "Get recipe by id.\nReturns public recipe, or private one if owned by current user.",
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
        handler: async (args, context) => {
          try {
            const recipe = await this.getRecipe(context.userId, args);
            return {
              text: `✅ Recipe loaded: ${recipe.title}`,
              json: { recipeId: recipe.id, recipe },
            };
          } catch (error) {
            if (error instanceof NotFoundException) {
              throwMcpError(404, "NOT_FOUND");
            }
            throw error;
          }
        },
      },
    };
  }

  async createManual(userId: string, args: Record<string, unknown>) {
    const dto = await this.validateDto(CreateProductDto, args);
    const signature = this.createSignature(dto);
    const cached = this.recentCreates.get(signature);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.product;
    }

    const product = await this.productsService.createManual(userId, dto);
    this.recentCreates.set(signature, {
      expiresAt: Date.now() + 30_000,
      product,
    });
    return product;
  }

  async search(userId: string | undefined, args: Record<string, unknown>) {
    const query = typeof args.query === "string" ? args.query : undefined;
    return this.productsService.search(userId, query);
  }

  async userMe(userId: string) {
    return this.usersService.getUserWithProfile(userId);
  }

  async upsertUserProfile(userId: string, args: Record<string, unknown>) {
    const dto = await this.validateDto(UpsertUserProfileDto, args);
    return this.usersService.upsertProfile(userId, dto);
  }

  async recalculateTargets(userId: string) {
    return this.usersService.recalculateTargets(userId);
  }

  async getBodyMetricsDay(userId: string, args: Record<string, unknown>) {
    const dto = await this.validateDto(GetBodyMetricsDayDto, args);
    return this.usersService.getBodyMetricsDay(userId, dto.date);
  }

  async upsertBodyMetrics(userId: string, args: Record<string, unknown>) {
    const dto = await this.validateDto(UpsertBodyMetricsDto, args);
    return this.usersService.upsertBodyMetrics(userId, dto);
  }

  async getBodyMetricsHistory(userId: string, args: Record<string, unknown>) {
    const dto = await this.validateDto(GetBodyMetricsHistoryDto, args);
    return this.usersService.getBodyMetricsHistory(userId, dto);
  }

  async getMealPlanDay(userId: string, args: Record<string, unknown>) {
    const dto = await this.validateDto(GetMealPlanDayDto, args);
    return this.mealPlansService.getDay(userId, dto.date);
  }

  async getMealPlanHistory(userId: string, args: Record<string, unknown>) {
    const dto = await this.validateDto(GetMealPlanHistoryDto, args);
    return this.mealPlansService.getHistory(userId, dto.date);
  }

  async addMealPlanEntry(userId: string, args: Record<string, unknown>) {
    const dto = await this.validateDto(AddMealPlanEntryDto, args);
    return this.mealPlansService.addEntry(userId, dto);
  }

  async removeMealPlanEntry(userId: string, args: Record<string, unknown>) {
    const dto = await this.validateDto(RemoveMealPlanEntryDto, args);
    return this.mealPlansService.removeEntry(userId, dto.entryId);
  }

  async getShoppingList(userId: string) {
    return this.shoppingListService.getList(userId);
  }

  async getSelfCareWeek(userId: string) {
    return this.selfCareRoutinesService.getWeek(userId);
  }

  async createSelfCareSlot(userId: string, args: Record<string, unknown>) {
    const dto = await this.validateDto(CreateSelfCareSlotDto, args);
    return this.selfCareRoutinesService.createSlot(userId, dto);
  }

  async updateSelfCareSlot(userId: string, args: Record<string, unknown>) {
    const idDto = await this.validateDto(SelfCareSlotIdDto, args);
    const dto = await this.validateDto(UpdateSelfCareSlotDto, args);
    return this.selfCareRoutinesService.updateSlot(userId, idDto.slotId, dto);
  }

  async removeSelfCareSlot(userId: string, args: Record<string, unknown>) {
    const dto = await this.validateDto(SelfCareSlotIdDto, args);
    return this.selfCareRoutinesService.removeSlot(userId, dto.slotId);
  }

  async createSelfCareItem(userId: string, args: Record<string, unknown>) {
    const slotDto = await this.validateDto(SelfCareSlotIdDto, args);
    const dto = await this.validateDto(CreateSelfCareItemDto, args);
    return this.selfCareRoutinesService.createItem(userId, slotDto.slotId, dto);
  }

  async updateSelfCareItem(userId: string, args: Record<string, unknown>) {
    const idDto = await this.validateDto(SelfCareItemIdDto, args);
    const dto = await this.validateDto(UpdateSelfCareItemDto, args);
    return this.selfCareRoutinesService.updateItem(userId, idDto.itemId, dto);
  }

  async removeSelfCareItem(userId: string, args: Record<string, unknown>) {
    const dto = await this.validateDto(SelfCareItemIdDto, args);
    return this.selfCareRoutinesService.removeItem(userId, dto.itemId);
  }

  async addShoppingCategory(userId: string, args: Record<string, unknown>) {
    const dto = await this.validateDto(AddShoppingCategoryDto, args);
    return this.shoppingListService.addCategory(userId, dto);
  }

  async addShoppingItem(userId: string, args: Record<string, unknown>) {
    const dto = await this.validateDto(AddShoppingItemDto, args);
    return this.shoppingListService.addItem(userId, dto);
  }

  async setShoppingItemState(userId: string, args: Record<string, unknown>) {
    const itemDto = await this.validateDto(ShoppingItemIdDto, args);
    const stateDto = await this.validateDto(SetShoppingItemStateDto, args);
    return this.shoppingListService.setItemState(userId, itemDto.itemId, stateDto.isDone);
  }

  async removeShoppingItem(userId: string, args: Record<string, unknown>) {
    const dto = await this.validateDto(ShoppingItemIdDto, args);
    return this.shoppingListService.removeItem(userId, dto.itemId);
  }

  async createRecipe(userId: string, args: Record<string, unknown>) {
    const dto = await this.validateDto(CreateRecipeDto, args);
    return this.recipesService.create(userId, dto);
  }

  async searchRecipes(userId: string | undefined, args: Record<string, unknown>) {
    const dto = await this.validateDto(SearchRecipesDto, args);
    return this.recipesService.search(userId, dto.query, dto.category, dto.limit);
  }

  async getRecipe(userId: string | undefined, args: Record<string, unknown>) {
    const dto = await this.validateDto(RecipeIdDto, args);
    return this.recipesService.get(dto.recipeId, userId);
  }

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
