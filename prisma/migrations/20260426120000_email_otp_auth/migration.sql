-- CreateEnum
CREATE TYPE "AuthCodePurpose" AS ENUM ('REGISTER', 'LOGIN');

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AuthEmailCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "purpose" "AuthCodePurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthEmailCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthEmailCode_expiresAt_idx" ON "AuthEmailCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthEmailCode_email_purpose_key" ON "AuthEmailCode"("email", "purpose");
