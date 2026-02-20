import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../common/prisma/prisma.module";
import { MealPlansController } from "./meal-plans.controller";
import { MealPlansService } from "./meal-plans.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [MealPlansController],
  providers: [MealPlansService],
  exports: [MealPlansService],
})
export class MealPlansModule {}
