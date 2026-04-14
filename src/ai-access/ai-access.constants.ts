export const SubscriptionStatus = {
  FREE: "FREE",
  TRIAL: "TRIAL",
  ACTIVE: "ACTIVE",
  EXPIRED: "EXPIRED",
} as const;

export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const AiFeature = {
  RECIPE_GENERATION: "RECIPE_GENERATION",
  MEAL_ANALYSIS: "MEAL_ANALYSIS",
  SMART_PRODUCT_MATCH: "SMART_PRODUCT_MATCH",
  ADVANCED_AI_TOOLS: "ADVANCED_AI_TOOLS",
} as const;

export type AiFeature = (typeof AiFeature)[keyof typeof AiFeature];

export const AI_FEATURE_VALUES = Object.values(AiFeature);
export const SUBSCRIPTION_STATUS_VALUES = Object.values(SubscriptionStatus);

export const DEFAULT_AI_ACTION_TOKEN_UNIT = 1_000;
export const DEFAULT_FREE_PLAN_MONTHLY_TOKEN_LIMIT = 100_000;
export const DEFAULT_FREE_PLAN_MONTHLY_AI_ACTIONS = 100;
export const DEFAULT_FREE_PLAN_PRICE_CENTS = 0;
export const DEFAULT_ACTIVE_PLAN_MONTHLY_TOKEN_LIMIT = 1_000_000;
export const DEFAULT_ACTIVE_PLAN_MONTHLY_AI_ACTIONS = 1_000;
export const DEFAULT_ACTIVE_PLAN_PRICE_CENTS = 999;
export const DEFAULT_TRIAL_TOKEN_LIMIT = 300_000;
export const DEFAULT_TRIAL_DAYS = 14;
export const DEFAULT_FREE_PLAN_CODE = "free";
export const DEFAULT_PAID_PLAN_CODE = "pro";
