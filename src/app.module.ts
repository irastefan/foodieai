import { Module } from "@nestjs/common";
import { PrismaModule } from "./common/prisma/prisma.module";
import { HealthController } from "./health/health.controller";
import { McpModule } from "./mcp/mcp.module";
import { OauthModule } from "./oauth/oauth.module";
import { ProductsModule } from "./products/products.module";
import { RecipesModule } from "./recipes/recipes.module";
import { UsersModule } from "./users/users.module";
import { AuthModule } from "./auth/auth.module";

@Module({
  imports: [
    PrismaModule,
    ProductsModule,
    RecipesModule,
    UsersModule,
    AuthModule,
    McpModule,
    OauthModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
