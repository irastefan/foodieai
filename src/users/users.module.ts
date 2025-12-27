import { Module, forwardRef } from "@nestjs/common";
import { PrismaModule } from "../common/prisma/prisma.module";
import { TdeeModule } from "../tdee/tdee.module";
import { AuthModule } from "../auth/auth.module";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [PrismaModule, TdeeModule, forwardRef(() => AuthModule)],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
