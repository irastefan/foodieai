# AI Plans

## Purpose

This document describes how AI tariff plans work in the backend, how `trial`, `free`, and `active` users are resolved, how token and action counters are calculated, and where the plan values are configured.

## Main Concepts

- `FREE`: user is on the free plan
- `TRIAL`: user is on a trial subscription
- `ACTIVE`: user is on the paid plan
- `tokensLimit`: the real quota limit used for enforcement
- `tokensUsed`: the real token consumption counter
- `aiActionsUsed` and `aiActionsRemaining`: derived metrics calculated from token usage

The source of truth for quota enforcement is always token usage, not AI actions.

## Where Plan Logic Lives

- Plan defaults and status enums: [src/ai-access/ai-access.constants.ts](/home/irastefan/Documents/projects/fodieai/src/ai-access/ai-access.constants.ts:1)
- Plan initialization, subscription normalization, quota calculations: [src/ai-access/ai-subscriptions.service.ts](/home/irastefan/Documents/projects/fodieai/src/ai-access/ai-subscriptions.service.ts:1)
- Token usage recording: [src/ai-access/ai-usage.service.ts](/home/irastefan/Documents/projects/fodieai/src/ai-access/ai-usage.service.ts:1)
- Initial DB seed for plans in migration: [prisma/migrations/20260410120000_add_ai_subscriptions_and_usage/migration.sql](/home/irastefan/Documents/projects/fodieai/prisma/migrations/20260410120000_add_ai_subscriptions_and_usage/migration.sql:132)

## How Plans Are Created

Default plans are upserted in `AiSubscriptionsService.ensureDefaultPlans()`.

Current plans:

- `free` / `plan_free`
- `pro` / `plan_pro`

The `ACTIVE` and `TRIAL` statuses both use the paid plan definition as the effective plan. The difference is that `TRIAL` gets its own token limit from trial settings.

## Effective Plan by Status

- `FREE` -> effective plan is `free`
- `ACTIVE` -> effective plan is `pro`
- `TRIAL` -> effective plan is `pro`

This mapping is implemented in `getEffectivePlan()`.

## How Token Limits Work

### Free

For a `FREE` user, `tokensLimit` comes from the free plan monthly token limit.

### Active

For an `ACTIVE` user, `tokensLimit` comes from the active/pro plan monthly token limit.

### Trial

For a `TRIAL` user, `tokensLimit` comes from `AI_TRIAL_TOKEN_LIMIT`, not from the paid plan token limit.

This is implemented in:

- `createInitialSubscription()`
- `resolveTokensLimit()`
- `getTrialTokenLimit()`

## How AI Actions Are Calculated

`AI actions` are not stored as a separate hard limit. They are derived from token usage.

Formulas:

- `aiActionsUsed = ceil(tokensUsed / actionTokenUnit)`
- `aiActionsRemaining = floor(tokensRemaining / actionTokenUnit)`

Where:

- `tokensRemaining = max(0, tokensLimit - tokensUsed)`
- `actionTokenUnit` is determined by `resolveActionTokenUnit()`

## How `actionTokenUnit` Is Resolved

If the effective plan has `monthlyAiActions`, then:

`actionTokenUnit = floor(monthlyTokenLimit / monthlyAiActions)`

Otherwise:

`actionTokenUnit = AI_ACTION_TOKEN_UNIT`

This means `AI_ACTION_TOKEN_UNIT` is only a fallback. In the current setup, `free` and `pro` both define `monthlyAiActions`, so the fallback is usually not used.

## Trial Action Logic

For `TRIAL`, the effective plan is still `pro`, so the action unit is calculated from the active/pro plan values.

Example with current defaults:

- `AI_ACTIVE_PLAN_MONTHLY_TOKEN_LIMIT=500000`
- `AI_ACTIVE_PLAN_MONTHLY_AI_ACTIONS=100`
- `actionTokenUnit = floor(500000 / 100) = 5000`

If `AI_TRIAL_TOKEN_LIMIT=100000`, then a fresh trial starts with:

- `tokensLimit = 100000`
- `aiActionsRemaining = floor(100000 / 5000) = 20`

Important: trial action count is based on the paid plan action unit, while the token limit itself comes from the trial config.

## Environment Variables

These values can be configured in `.env`. Example defaults are listed in [.env.example](/home/irastefan/Documents/projects/fodieai/.env.example:1).

### Free Plan

- `AI_FREE_PLAN_MONTHLY_TOKEN_LIMIT`
- `AI_FREE_PLAN_MONTHLY_AI_ACTIONS`
- `AI_FREE_PLAN_PRICE_CENTS`

### Active Plan

- `AI_ACTIVE_PLAN_MONTHLY_TOKEN_LIMIT`
- `AI_ACTIVE_PLAN_MONTHLY_AI_ACTIONS`
- `AI_ACTIVE_PLAN_PRICE_CENTS`

### Trial

- `AI_TRIAL_TOKEN_LIMIT`
- `AI_TRIAL_DAYS`

### Fallback and Codes

- `AI_ACTION_TOKEN_UNIT`
- `AI_DEFAULT_FREE_PLAN_CODE`
- `AI_DEFAULT_PAID_PLAN_CODE`

## Current Default Values

Defaults are defined in `src/ai-access/ai-access.constants.ts`.

- free monthly token limit: `25000`
- free monthly AI actions: `5`
- free price: `0`
- active monthly token limit: `500000`
- active monthly AI actions: `100`
- active price: `999`
- trial token limit: `100000`
- trial duration: `14` days
- fallback action token unit: `5000`

## How Usage Is Recorded

After an OpenAI response is received, token usage is extracted and written to `aiUsageLog`. Then `userAiSubscription.tokensUsed` is incremented by the total token count.

This happens in [src/ai-access/ai-usage.service.ts](/home/irastefan/Documents/projects/fodieai/src/ai-access/ai-usage.service.ts:35).

## Migration vs Runtime Config

The migration contains initial seeded values for `plan_free` and `plan_pro`, but runtime code calls `ensureDefaultPlans()` and upserts plan values again. That means the runtime env configuration can overwrite the original seeded plan limits and prices in the database.

Practical implication:

- migration values are the initial bootstrap values
- runtime env values are the operational source of truth after the service starts

## Summary

- quota enforcement is token-based
- AI actions are derived from token usage
- `TRIAL` uses the paid plan as the effective plan for features and action-unit calculation
- `TRIAL` uses its own token limit from `AI_TRIAL_TOKEN_LIMIT`
- free and active plan values are configurable through `.env`
