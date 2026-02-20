import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MealPlansModule } from "../meal-plans/meal-plans.module";
import { ProductsModule } from "../products/products.module";
import { RecipesModule } from "../recipes/recipes.module";
import { UsersModule } from "../users/users.module";
import { McpController } from "./mcp.controller";
import { McpService } from "./mcp.service";

@Module({
  imports: [ProductsModule, RecipesModule, MealPlansModule, UsersModule, AuthModule],
  controllers: [McpController],
  providers: [McpService],
})
export class McpModule {}
