/*
  Warnings:

  - A unique constraint covering the columns `[draftId,order]` on the table `RecipeDraftIngredient` will be added. If there are existing duplicate values, this will fail.
  - Made the column `order` on table `RecipeDraftIngredient` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "RecipeDraftIngredient" ALTER COLUMN "order" SET NOT NULL;

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "entityId" TEXT,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_operation_key_entityId_key" ON "IdempotencyKey"("operation", "key", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeDraftIngredient_draftId_order_key" ON "RecipeDraftIngredient"("draftId", "order");
