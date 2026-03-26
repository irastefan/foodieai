CREATE TABLE "UserBodyMetricEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "weightKg" DOUBLE PRECISION,
  "measurements" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserBodyMetricEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserBodyMetricEntry_userId_date_key"
ON "UserBodyMetricEntry"("userId", "date");

CREATE INDEX "UserBodyMetricEntry_userId_date_idx"
ON "UserBodyMetricEntry"("userId", "date");

ALTER TABLE "UserBodyMetricEntry"
ADD CONSTRAINT "UserBodyMetricEntry_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
