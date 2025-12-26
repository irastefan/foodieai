import { Module } from "@nestjs/common";
import { ProductsModule } from "../products/products.module";
import { OauthModule } from "../oauth/oauth.module";
import { McpController } from "./mcp.controller";
import { McpService } from "./mcp.service";

@Module({
  imports: [ProductsModule, OauthModule],
  controllers: [McpController],
  providers: [McpService],
})
export class McpModule {}
