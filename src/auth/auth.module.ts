import { Module, forwardRef } from "@nestjs/common";
import { OauthModule } from "../oauth/oauth.module";
import { UsersModule } from "../users/users.module";
import { AuthContextService } from "./auth-context.service";

@Module({
  imports: [OauthModule, forwardRef(() => UsersModule)],
  providers: [AuthContextService],
  exports: [AuthContextService],
})
export class AuthModule {}
