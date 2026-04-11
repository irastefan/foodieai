import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MealPlansModule } from "../meal-plans/meal-plans.module";
import { ProductsModule } from "../products/products.module";
import { RecipesModule } from "../recipes/recipes.module";
import { SelfCareRoutinesModule } from "../self-care-routines/self-care-routines.module";
import { ShoppingListModule } from "../shopping-list/shopping-list.module";
import { UsersModule } from "../users/users.module";
import { McpController } from "./mcp.controller";
import { McpService } from "./mcp.service";

@Module({
  imports: [ProductsModule, RecipesModule, MealPlansModule, SelfCareRoutinesModule, ShoppingListModule, UsersModule, AuthModule],
  controllers: [McpController],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
