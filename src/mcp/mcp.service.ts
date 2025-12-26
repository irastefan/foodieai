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
  constructor(private readonly productsService: ProductsService) {}

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
      },
    ];
  }

  async createManual(args: Record<string, unknown>) {
    const dto = await this.validateDto(CreateProductDto, args);
    return this.productsService.createManual(dto);
  }

  async search(args: Record<string, unknown>) {
    const query = typeof args.query === "string" ? args.query : undefined;
    return this.productsService.search(query);
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
}
