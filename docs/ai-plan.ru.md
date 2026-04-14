# AI Plans

## Назначение

Этот документ описывает, как в бэкенде работают тарифные AI-планы, как обрабатываются статусы `trial`, `free` и `active`, как считаются токены и `AI actions`, и где задаются значения планов.

## Основные понятия

- `FREE`: пользователь на бесплатном плане
- `TRIAL`: пользователь на пробном периоде
- `ACTIVE`: пользователь на платном плане
- `tokensLimit`: реальный лимит квоты, который используется для проверки доступа
- `tokensUsed`: фактически израсходованные токены
- `aiActionsUsed` и `aiActionsRemaining`: производные метрики, которые вычисляются из токенов

Важно: источником истины для ограничения квоты всегда являются токены, а не `AI actions`.

## Где находится логика планов

- Дефолты планов и enum-значения статусов: [src/ai-access/ai-access.constants.ts](/home/irastefan/Documents/projects/fodieai/src/ai-access/ai-access.constants.ts:1)
- Инициализация планов, нормализация подписки, расчёт квот: [src/ai-access/ai-subscriptions.service.ts](/home/irastefan/Documents/projects/fodieai/src/ai-access/ai-subscriptions.service.ts:1)
- Запись использования токенов: [src/ai-access/ai-usage.service.ts](/home/irastefan/Documents/projects/fodieai/src/ai-access/ai-usage.service.ts:1)
- Начальные значения планов в миграции: [prisma/migrations/20260410120000_add_ai_subscriptions_and_usage/migration.sql](/home/irastefan/Documents/projects/fodieai/prisma/migrations/20260410120000_add_ai_subscriptions_and_usage/migration.sql:132)

## Как создаются планы

Дефолтные планы создаются или обновляются в `AiSubscriptionsService.ensureDefaultPlans()`.

Текущие планы:

- `free` / `plan_free`
- `pro` / `plan_pro`

Статусы `ACTIVE` и `TRIAL` используют платный план как `effective plan`. Разница между ними в том, что у `TRIAL` свой отдельный лимит токенов.

## Effective plan по статусу

- `FREE` -> effective plan = `free`
- `ACTIVE` -> effective plan = `pro`
- `TRIAL` -> effective plan = `pro`

Эта логика реализована в `getEffectivePlan()`.

## Как работают лимиты токенов

### Free

Для `FREE` пользователя `tokensLimit` берётся из месячного лимита бесплатного плана.

### Active

Для `ACTIVE` пользователя `tokensLimit` берётся из месячного лимита active/pro плана.

### Trial

Для `TRIAL` пользователя `tokensLimit` берётся из `AI_TRIAL_TOKEN_LIMIT`, а не из лимита paid-плана.

Это реализовано в:

- `createInitialSubscription()`
- `resolveTokensLimit()`
- `getTrialTokenLimit()`

## Как считаются AI actions

`AI actions` не хранятся как отдельный жёсткий лимит. Они вычисляются на основе потребления токенов.

Формулы:

- `aiActionsUsed = ceil(tokensUsed / actionTokenUnit)`
- `aiActionsRemaining = floor(tokensRemaining / actionTokenUnit)`

Где:

- `tokensRemaining = max(0, tokensLimit - tokensUsed)`
- `actionTokenUnit` определяется через `resolveActionTokenUnit()`

## Как определяется `actionTokenUnit`

Если у effective plan задан `monthlyAiActions`, тогда:

`actionTokenUnit = floor(monthlyTokenLimit / monthlyAiActions)`

Иначе:

`actionTokenUnit = AI_ACTION_TOKEN_UNIT`

Это значит, что `AI_ACTION_TOKEN_UNIT` используется только как fallback. В текущей конфигурации и `free`, и `pro` задают `monthlyAiActions`, поэтому fallback обычно не используется.

## Логика trial для AI actions

Для `TRIAL` effective plan всё равно `pro`, поэтому единица действия считается из параметров active/pro плана.

Пример с текущими дефолтами:

- `AI_ACTIVE_PLAN_MONTHLY_TOKEN_LIMIT=500000`
- `AI_ACTIVE_PLAN_MONTHLY_AI_ACTIONS=100`
- `actionTokenUnit = floor(500000 / 100) = 5000`

Если `AI_TRIAL_TOKEN_LIMIT=100000`, то новый trial стартует с:

- `tokensLimit = 100000`
- `aiActionsRemaining = floor(100000 / 5000) = 20`

Важно: для `trial` количество actions считается через unit от paid-плана, а сам лимит токенов берётся из trial-конфига.

## Переменные окружения

Эти значения можно задавать в `.env`. Примеры дефолтов есть в [.env.example](/home/irastefan/Documents/projects/fodieai/.env.example:1).

### Free plan

- `AI_FREE_PLAN_MONTHLY_TOKEN_LIMIT`
- `AI_FREE_PLAN_MONTHLY_AI_ACTIONS`
- `AI_FREE_PLAN_PRICE_CENTS`

### Active plan

- `AI_ACTIVE_PLAN_MONTHLY_TOKEN_LIMIT`
- `AI_ACTIVE_PLAN_MONTHLY_AI_ACTIONS`
- `AI_ACTIVE_PLAN_PRICE_CENTS`

### Trial

- `AI_TRIAL_TOKEN_LIMIT`
- `AI_TRIAL_DAYS`

### Fallback и коды планов

- `AI_ACTION_TOKEN_UNIT`
- `AI_DEFAULT_FREE_PLAN_CODE`
- `AI_DEFAULT_PAID_PLAN_CODE`

## Текущие дефолтные значения

Дефолты определены в `src/ai-access/ai-access.constants.ts`.

- free monthly token limit: `25000`
- free monthly AI actions: `5`
- free price: `0`
- active monthly token limit: `500000`
- active monthly AI actions: `100`
- active price: `999`
- trial token limit: `100000`
- trial duration: `14` дней
- fallback action token unit: `5000`

## Как записывается usage

После ответа OpenAI из ответа извлекается usage по токенам, затем запись добавляется в `aiUsageLog`, а `userAiSubscription.tokensUsed` увеличивается на общее число токенов.

Это происходит в [src/ai-access/ai-usage.service.ts](/home/irastefan/Documents/projects/fodieai/src/ai-access/ai-usage.service.ts:35).

## Migration против runtime config

В миграции лежат стартовые значения `plan_free` и `plan_pro`, но во время работы приложения вызывается `ensureDefaultPlans()`, который снова делает upsert значений планов. Это значит, что значения из runtime env могут перезаписать исходные seed-значения в базе.

Практически это означает:

- значения из миграции нужны для первичного bootstrap
- значения из `.env` являются рабочим источником истины после старта сервиса

## Кратко

- квота ограничивается токенами
- `AI actions` считаются из токенов
- `TRIAL` использует paid-plan как effective plan для фич и для расчёта `actionTokenUnit`
- `TRIAL` использует свой собственный `tokensLimit` из `AI_TRIAL_TOKEN_LIMIT`
- значения free и active плана можно задавать через `.env`
