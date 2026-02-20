/*
  Warnings:

  - You are about to drop the `RecipeDraft` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RecipeDraftIngredient` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RecipeDraftStep` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "RecipeDraft" DROP CONSTRAINT "RecipeDraft_sourceRecipeId_fkey";

-- DropForeignKey
ALTER TABLE "RecipeDraftIngredient" DROP CONSTRAINT "RecipeDraftIngredient_draftId_fkey";

-- DropForeignKey
ALTER TABLE "RecipeDraftIngredient" DROP CONSTRAINT "RecipeDraftIngredient_productId_fkey";

-- DropForeignKey
ALTER TABLE "RecipeDraftStep" DROP CONSTRAINT "RecipeDraftStep_draftId_fkey";

-- DropTable
DROP TABLE "RecipeDraft";

-- DropTable
DROP TABLE "RecipeDraftIngredient";

-- DropTable
DROP TABLE "RecipeDraftStep";

-- DropEnum
DROP TYPE "RecipeStatus";
