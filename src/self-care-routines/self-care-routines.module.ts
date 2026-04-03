import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../common/prisma/prisma.module";
import { SelfCareRoutinesController } from "./self-care-routines.controller";
import { SelfCareRoutinesService } from "./self-care-routines.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SelfCareRoutinesController],
  providers: [SelfCareRoutinesService],
  exports: [SelfCareRoutinesService],
})
export class SelfCareRoutinesModule {}
