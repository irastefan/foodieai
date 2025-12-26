import { Injectable } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate, ValidationError } from "class-validator";
import { CreateProductDto } from "../products/dto/create-product.dto";
import { ProductsService } from "../products/products.service";

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
  constructor(private readonly productsService: ProductsService) {}

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
    ];
  }

  // MCP tool: product.createManual
  async createManual(args: Record<string, unknown>) {
    const dto = await this.validateDto(CreateProductDto, args);
    return this.productsService.createManual(dto);
  }

  // MCP tool: product.search
  async search(args: Record<string, unknown>) {
    const query = typeof args.query === "string" ? args.query : undefined;
    return this.productsService.search(query);
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
}
