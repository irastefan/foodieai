import { Module, forwardRef } from "@nestjs/common";
import { UsersModule } from "../users/users.module";
import { AuthContextService } from "./auth-context.service";

@Module({
  imports: [forwardRef(() => UsersModule)],
  providers: [AuthContextService],
  exports: [AuthContextService],
})
export class AuthModule {}
