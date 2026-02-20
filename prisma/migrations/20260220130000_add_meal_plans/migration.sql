-- CreateEnum
CREATE TYPE "MealSlot" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- CreateEnum
CREATE TYPE "MealEntryType" AS ENUM ('PRODUCT', 'RECIPE');

-- CreateTable
CREATE TABLE "MealPlanDay" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "nutritionBySlot" JSONB,
  "nutritionTotal" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MealPlanDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlanEntry" (
  "id" TEXT NOT NULL,
  "dayId" TEXT NOT NULL,
  "slot" "MealSlot" NOT NULL,
  "entryType" "MealEntryType" NOT NULL,
  "order" INTEGER NOT NULL,
  "productId" TEXT,
  "recipeId" TEXT,
  "amount" DOUBLE PRECISION,
  "unit" TEXT,
  "servings" DOUBLE PRECISION,
  "nutritionTotal" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MealPlanEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MealPlanDay_ownerUserId_date_key" ON "MealPlanDay"("ownerUserId", "date");

-- CreateIndex
CREATE INDEX "MealPlanEntry_dayId_slot_idx" ON "MealPlanEntry"("dayId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "MealPlanEntry_dayId_slot_order_key" ON "MealPlanEntry"("dayId", "slot", "order");

-- AddForeignKey
ALTER TABLE "MealPlanDay" ADD CONSTRAINT "MealPlanDay_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanEntry" ADD CONSTRAINT "MealPlanEntry_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "MealPlanDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanEntry" ADD CONSTRAINT "MealPlanEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanEntry" ADD CONSTRAINT "MealPlanEntry_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
