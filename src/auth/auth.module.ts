import { Module, forwardRef } from "@nestjs/common";
import { UsersModule } from "../users/users.module";
import { AuthContextService } from "./auth-context.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [forwardRef(() => UsersModule)],
  controllers: [AuthController],
  providers: [AuthService, AuthContextService],
  exports: [AuthService, AuthContextService],
})
export class AuthModule {}
