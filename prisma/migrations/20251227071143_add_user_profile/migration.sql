-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('FEMALE', 'MALE');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('SEDENTARY', 'LIGHT', 'MODERATE', 'VERY_ACTIVE');

-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('MAINTAIN', 'LOSE', 'GAIN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "sex" "Sex",
    "birthDate" TIMESTAMP(3),
    "heightCm" INTEGER,
    "weightKg" DOUBLE PRECISION,
    "activityLevel" "ActivityLevel",
    "goal" "GoalType" DEFAULT 'MAINTAIN',
    "targetCalories" INTEGER,
    "targetProteinG" INTEGER,
    "targetFatG" INTEGER,
    "targetCarbsG" INTEGER,
    "calorieDelta" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_externalId_key" ON "User"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
