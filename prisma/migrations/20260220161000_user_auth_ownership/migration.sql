-- Ensure at least one legacy user exists for ownership backfill.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "User") THEN
    INSERT INTO "User" ("id", "externalId", "createdAt")
    VALUES ('legacy_owner', 'legacy_owner', CURRENT_TIMESTAMP);
  END IF;
END
$$;

-- Add new auth columns as nullable first.
ALTER TABLE "User" ADD COLUMN "email" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;

-- Backfill email/passwordHash for existing users.
UPDATE "User"
SET "email" = LOWER(
      CASE
        WHEN POSITION('@' IN "externalId") > 0 THEN "externalId"
        ELSE "externalId" || '@legacy.local'
      END
    )
WHERE "email" IS NULL;

UPDATE "User"
SET "passwordHash" = '1acea2ae9f0f2334d1d3ae053fc8ee52:b8fdf83b3735f716739a5bee7d261a5687356b87b70b86f7c6db57fd28b321627a7c847e310a734ebd6f275913b9b74699d2df31cb1c3e672cd32290545c3a78'
WHERE "passwordHash" IS NULL;

-- Make externalId optional in the new model.
ALTER TABLE "User" ALTER COLUMN "externalId" DROP NOT NULL;

-- Backfill owner for legacy products/recipes.
DO $$
DECLARE
  fallback_user_id TEXT;
BEGIN
  SELECT "id" INTO fallback_user_id
  FROM "User"
  ORDER BY "createdAt" ASC
  LIMIT 1;

  UPDATE "Product"
  SET "ownerUserId" = fallback_user_id
  WHERE "ownerUserId" IS NULL;

  UPDATE "Recipe"
  SET "ownerUserId" = fallback_user_id
  WHERE "ownerUserId" IS NULL;
END
$$;

-- Enforce new required columns.
ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "passwordHash" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "ownerUserId" SET NOT NULL;
ALTER TABLE "Recipe" ALTER COLUMN "ownerUserId" SET NOT NULL;

-- Constraints/indexes expected by Prisma schema.
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Recipe"
  ADD CONSTRAINT "Recipe_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
