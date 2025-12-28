import { Module } from "@nestjs/common";
import { PrismaModule } from "../common/prisma/prisma.module";
import { RecipeDraftsService } from "./recipe-drafts.service";
import { RecipesService } from "./recipes.service";

@Module({
  imports: [PrismaModule],
  providers: [RecipeDraftsService, RecipesService],
  exports: [RecipeDraftsService, RecipesService],
})
export class RecipesModule {}
