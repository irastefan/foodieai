import { Module } from "@nestjs/common";
import { PrismaModule } from "../common/prisma/prisma.module";
import { RecipeDraftsController } from "./recipe-drafts.controller";
import { RecipeDraftsService } from "./recipe-drafts.service";
import { RecipesController } from "./recipes.controller";
import { RecipesService } from "./recipes.service";

@Module({
  imports: [PrismaModule],
  controllers: [RecipesController, RecipeDraftsController],
  providers: [RecipeDraftsService, RecipesService],
  exports: [RecipeDraftsService, RecipesService],
})
export class RecipesModule {}
