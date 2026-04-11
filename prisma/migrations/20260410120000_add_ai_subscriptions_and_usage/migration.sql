DO $$
BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('FREE', 'TRIAL', 'ACTIVE', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AiFeature" AS ENUM (
    'RECIPE_GENERATION',
    'MEAL_ANALYSIS',
    'SMART_PRODUCT_MATCH',
    'ADVANCED_AI_TOOLS'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "AiPlan" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "monthlyTokenLimit" INTEGER NOT NULL,
  "monthlyAiActions" INTEGER,
  "priceCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiPlan_code_key" ON "AiPlan"("code");

CREATE TABLE IF NOT EXISTS "AiPlanFeature" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "feature" "AiFeature" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiPlanFeature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiPlanFeature_planId_feature_key"
ON "AiPlanFeature"("planId", "feature");

CREATE INDEX IF NOT EXISTS "AiPlanFeature_feature_idx" ON "AiPlanFeature"("feature");

CREATE TABLE IF NOT EXISTS "UserAiSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'FREE',
  "planId" TEXT,
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "tokensUsed" INTEGER NOT NULL DEFAULT 0,
  "tokensLimit" INTEGER NOT NULL DEFAULT 0,
  "trialStartedAt" TIMESTAMP(3),
  "trialEndsAt" TIMESTAMP(3),
  "trialTokenLimit" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserAiSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserAiSubscription_userId_key" ON "UserAiSubscription"("userId");

CREATE TABLE IF NOT EXISTS "AiUsageLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "actionType" TEXT NOT NULL,
  "feature" "AiFeature",
  "promptTokens" INTEGER,
  "completionTokens" INTEGER,
  "totalTokens" INTEGER NOT NULL,
  "model" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AiUsageLog_userId_createdAt_idx" ON "AiUsageLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AiUsageLog_subscriptionId_createdAt_idx" ON "AiUsageLog"("subscriptionId", "createdAt");
CREATE INDEX IF NOT EXISTS "AiUsageLog_feature_createdAt_idx" ON "AiUsageLog"("feature", "createdAt");

DO $$
BEGIN
  ALTER TABLE "AiPlanFeature"
    ADD CONSTRAINT "AiPlanFeature_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "AiPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "UserAiSubscription"
    ADD CONSTRAINT "UserAiSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "UserAiSubscription"
    ADD CONSTRAINT "UserAiSubscription_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "AiPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "AiUsageLog"
    ADD CONSTRAINT "AiUsageLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "AiUsageLog"
    ADD CONSTRAINT "AiUsageLog_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "UserAiSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "AiPlan" (
  "id", "name", "code", "monthlyTokenLimit", "monthlyAiActions", "priceCents", "currency", "isActive", "createdAt", "updatedAt"
)
VALUES
  ('plan_free', 'Free', 'free', 25000, 5, 0, 'USD', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan_pro', 'Pro', 'pro', 500000, 100, 999, 'USD', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "monthlyTokenLimit" = EXCLUDED."monthlyTokenLimit",
  "monthlyAiActions" = EXCLUDED."monthlyAiActions",
  "priceCents" = EXCLUDED."priceCents",
  "currency" = EXCLUDED."currency",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "AiPlanFeature" ("id", "planId", "feature", "createdAt")
SELECT 'plan_feature_free_meal_analysis', p."id", 'MEAL_ANALYSIS'::"AiFeature", CURRENT_TIMESTAMP
FROM "AiPlan" p
WHERE p."code" = 'free'
ON CONFLICT ("planId", "feature") DO NOTHING;

INSERT INTO "AiPlanFeature" ("id", "planId", "feature", "createdAt")
SELECT 'plan_feature_free_smart_product_match', p."id", 'SMART_PRODUCT_MATCH'::"AiFeature", CURRENT_TIMESTAMP
FROM "AiPlan" p
WHERE p."code" = 'free'
ON CONFLICT ("planId", "feature") DO NOTHING;

INSERT INTO "AiPlanFeature" ("id", "planId", "feature", "createdAt")
SELECT 'plan_feature_pro_recipe_generation', p."id", 'RECIPE_GENERATION'::"AiFeature", CURRENT_TIMESTAMP
FROM "AiPlan" p
WHERE p."code" = 'pro'
ON CONFLICT ("planId", "feature") DO NOTHING;

INSERT INTO "AiPlanFeature" ("id", "planId", "feature", "createdAt")
SELECT 'plan_feature_pro_meal_analysis', p."id", 'MEAL_ANALYSIS'::"AiFeature", CURRENT_TIMESTAMP
FROM "AiPlan" p
WHERE p."code" = 'pro'
ON CONFLICT ("planId", "feature") DO NOTHING;

INSERT INTO "AiPlanFeature" ("id", "planId", "feature", "createdAt")
SELECT 'plan_feature_pro_smart_product_match', p."id", 'SMART_PRODUCT_MATCH'::"AiFeature", CURRENT_TIMESTAMP
FROM "AiPlan" p
WHERE p."code" = 'pro'
ON CONFLICT ("planId", "feature") DO NOTHING;

INSERT INTO "AiPlanFeature" ("id", "planId", "feature", "createdAt")
SELECT 'plan_feature_pro_advanced_tools', p."id", 'ADVANCED_AI_TOOLS'::"AiFeature", CURRENT_TIMESTAMP
FROM "AiPlan" p
WHERE p."code" = 'pro'
ON CONFLICT ("planId", "feature") DO NOTHING;
