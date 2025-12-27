import { Injectable } from "@nestjs/common";
import { Product } from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validate, ValidationError } from "class-validator";
import { CreateProductDto } from "../products/dto/create-product.dto";
import { ProductsService } from "../products/products.service";
import { UpsertUserProfileDto } from "../users/dto/upsert-user-profile.dto";
import { UsersService } from "../users/users.service";

export class McpValidationError extends Error {
  readonly errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    super("Validation failed");
    this.errors = errors;
  }
}

@Injectable()
export class McpService {
  // MCP tool definitions and thin wrappers around product operations.
  constructor(
    private readonly productsService: ProductsService,
    private readonly usersService: UsersService,
  ) {}

  private readonly recentCreates = new Map<
    string,
    { expiresAt: number; product: Product }
  >();

  // Tool catalog exposed via tools/list.
  listTools() {
    return [
      {
        name: "product.createManual",
        description: "Create a product manually in FoodieAI",
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
      },
      {
        name: "product.search",
        description: "Search products by name or brand",
        public: true,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            query: { type: ["string", "null"] },
          },
          required: [],
        },
        outputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            count: { type: "number" },
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  brand: { type: ["string", "null"] },
                  price: { type: ["number", "null"] },
                  currency: { type: ["string", "null"] },
                  store: { type: ["string", "null"] },
                  url: { type: ["string", "null"] },
                  image_url: { type: ["string", "null"] },
                  nutrition: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      kcal100: { type: ["number", "null"] },
                      protein100: { type: ["number", "null"] },
                      fat100: { type: ["number", "null"] },
                      carbs100: { type: ["number", "null"] },
                    },
                  },
                },
                required: ["id", "name", "brand", "price", "currency", "store", "url", "image_url"],
              },
            },
          },
          required: ["count", "items"],
        },
      },
      {
        name: "user.me",
        description: "Get current user and profile",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {},
          required: [],
        },
        outputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            user: { type: "object" },
            profile: { type: ["object", "null"] },
          },
          required: ["user", "profile"],
        },
      },
      {
        name: "userProfile.upsert",
        description: "Create or update user profile and calculate targets",
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
        outputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            profile: { type: "object" },
          },
          required: ["profile"],
        },
      },
      {
        name: "userTargets.recalculate",
        description: "Recalculate daily calorie and macro targets",
        public: false,
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {},
          required: [],
        },
        outputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            profile: { type: "object" },
          },
          required: ["profile"],
        },
      },
    ];
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
