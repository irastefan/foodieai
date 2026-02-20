import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./common/prisma/prisma.module";
import { HealthController } from "./health/health.controller";
import { MealPlansModule } from "./meal-plans/meal-plans.module";
import { McpModule } from "./mcp/mcp.module";
import { ProductsModule } from "./products/products.module";
import { RecipesModule } from "./recipes/recipes.module";
import { ShoppingListModule } from "./shopping-list/shopping-list.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    PrismaModule,
    ProductsModule,
    RecipesModule,
    MealPlansModule,
    ShoppingListModule,
    UsersModule,
    AuthModule,
    McpModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
