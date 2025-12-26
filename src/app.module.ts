import { Module } from "@nestjs/common";
import { PrismaModule } from "./common/prisma/prisma.module";
import { HealthController } from "./health/health.controller";
import { McpModule } from "./mcp/mcp.module";
import { OauthModule } from "./oauth/oauth.module";
import { ProductsModule } from "./products/products.module";

@Module({
  imports: [PrismaModule, ProductsModule, McpModule, OauthModule],
  controllers: [HealthController],
})
export class AppModule {}
