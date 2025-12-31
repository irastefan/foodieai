-- AlterTable
ALTER TABLE "RecipeDraft" ADD COLUMN     "sourceRecipeId" TEXT;

-- AddForeignKey
ALTER TABLE "RecipeDraft" ADD CONSTRAINT "RecipeDraft_sourceRecipeId_fkey" FOREIGN KEY ("sourceRecipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
