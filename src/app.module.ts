import { AiModule } from "./ai/ai.module";
import { Module } from "@nestjs/common";
import { AiAccessModule } from "./ai-access/ai-access.module";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./common/prisma/prisma.module";
import { HealthController } from "./health/health.controller";
import { MealPlansModule } from "./meal-plans/meal-plans.module";
import { McpModule } from "./mcp/mcp.module";
import { ProductsModule } from "./products/products.module";
import { RecipesModule } from "./recipes/recipes.module";
import { SelfCareRoutinesModule } from "./self-care-routines/self-care-routines.module";
import { ShoppingListModule } from "./shopping-list/shopping-list.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    PrismaModule,
    AiModule,
    AiAccessModule,
    ProductsModule,
    RecipesModule,
    MealPlansModule,
    SelfCareRoutinesModule,
    ShoppingListModule,
    UsersModule,
    AuthModule,
    McpModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
