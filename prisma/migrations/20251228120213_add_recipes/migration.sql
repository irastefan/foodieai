-- CreateEnum
CREATE TYPE "RecipeStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "RecipeVisibility" AS ENUM ('PRIVATE', 'PUBLIC');

-- CreateTable
CREATE TABLE "RecipeDraft" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "servings" INTEGER,
    "status" "RecipeStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeDraftIngredient" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "order" INTEGER,
    "originalText" TEXT,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "unit" TEXT,
    "productId" TEXT,
    "kcal100" DOUBLE PRECISION,
    "protein100" DOUBLE PRECISION,
    "fat100" DOUBLE PRECISION,
    "carbs100" DOUBLE PRECISION,
    "assumptions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeDraftIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeDraftStep" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "RecipeDraftStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "servings" INTEGER,
    "visibility" "RecipeVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "order" INTEGER,
    "originalText" TEXT,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "unit" TEXT,
    "productId" TEXT,
    "kcal100" DOUBLE PRECISION,
    "protein100" DOUBLE PRECISION,
    "fat100" DOUBLE PRECISION,
    "carbs100" DOUBLE PRECISION,
    "assumptions" JSONB,

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeStep" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "RecipeStep_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RecipeDraftIngredient" ADD CONSTRAINT "RecipeDraftIngredient_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "RecipeDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeDraftIngredient" ADD CONSTRAINT "RecipeDraftIngredient_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeDraftStep" ADD CONSTRAINT "RecipeDraftStep_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "RecipeDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeStep" ADD CONSTRAINT "RecipeStep_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
