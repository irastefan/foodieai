-- CreateEnum
CREATE TYPE "ProductScope" AS ENUM ('GLOBAL', 'USER');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('VERIFIED', 'PENDING_REVIEW');

-- CreateEnum
CREATE TYPE "ProductSource" AS ENUM ('INTERNAL', 'FATSECRET', 'AI_ESTIMATED');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "normalizedName" TEXT NOT NULL,
    "scope" "ProductScope" NOT NULL,
    "status" "ProductStatus" NOT NULL,
    "ownerUserId" TEXT,
    "source" "ProductSource" NOT NULL,
    "kcal100" INTEGER NOT NULL,
    "protein100" DOUBLE PRECISION NOT NULL,
    "fat100" DOUBLE PRECISION NOT NULL,
    "carbs100" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_normalizedName_idx" ON "Product"("normalizedName");
