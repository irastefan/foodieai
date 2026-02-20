import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../common/prisma/prisma.module";
import { ShoppingListController } from "./shopping-list.controller";
import { ShoppingListService } from "./shopping-list.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ShoppingListController],
  providers: [ShoppingListService],
  exports: [ShoppingListService],
})
export class ShoppingListModule {}
