-- CreateEnum
CREATE TYPE "RoutineWeekday" AS ENUM (
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY'
);

-- CreateTable
CREATE TABLE "SelfCareRoutineSlot" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "weekday" "RoutineWeekday" NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SelfCareRoutineSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelfCareRoutineItem" (
  "id" TEXT NOT NULL,
  "slotId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "note" TEXT,
  "order" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SelfCareRoutineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SelfCareRoutineSlot_ownerUserId_weekday_order_idx" ON "SelfCareRoutineSlot"("ownerUserId", "weekday", "order");

-- CreateIndex
CREATE UNIQUE INDEX "SelfCareRoutineSlot_ownerUserId_weekday_normalizedName_key" ON "SelfCareRoutineSlot"("ownerUserId", "weekday", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "SelfCareRoutineSlot_ownerUserId_weekday_order_key" ON "SelfCareRoutineSlot"("ownerUserId", "weekday", "order");

-- CreateIndex
CREATE INDEX "SelfCareRoutineItem_slotId_order_idx" ON "SelfCareRoutineItem"("slotId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "SelfCareRoutineItem_slotId_order_key" ON "SelfCareRoutineItem"("slotId", "order");

-- AddForeignKey
ALTER TABLE "SelfCareRoutineSlot"
ADD CONSTRAINT "SelfCareRoutineSlot_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelfCareRoutineItem"
ADD CONSTRAINT "SelfCareRoutineItem_slotId_fkey"
FOREIGN KEY ("slotId") REFERENCES "SelfCareRoutineSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
