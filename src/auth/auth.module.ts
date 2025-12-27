import { Module, forwardRef } from "@nestjs/common";
import { OauthModule } from "../oauth/oauth.module";
import { UsersModule } from "../users/users.module";
import { AuthContextService } from "./auth-context.service";
import { McpAuthGuard } from "./mcp-auth.guard";

@Module({
  imports: [OauthModule, forwardRef(() => UsersModule)],
  providers: [AuthContextService, McpAuthGuard],
  exports: [AuthContextService, McpAuthGuard],
})
export class AuthModule {}
