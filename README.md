# FoodieAI Backend (MVP)

NestJS + Prisma + Postgres backend with REST + MCP (JSON-RPC).

## Requirements
- Node.js 20+
- Postgres connection string in `DATABASE_URL`

## Setup (local)
```bash
npm install
npm run prisma:generate
npm run prisma:migrate:dev
npm run start:dev
```

## Build
```bash
npm run build
```

## Swagger
`http://localhost:3000/docs`

## Environment
Create `.env` from `.env.example`.

## REST Endpoints
- `GET /health`
- `POST /v1/products`
- `GET /v1/products?query=...`
- `PATCH /v1/products/:productId`
- `DELETE /v1/products/:productId`
- `GET /v1/body-metrics/daily?date=YYYY-MM-DD`
- `PUT /v1/body-metrics/daily`
- `GET /v1/body-metrics/history?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD`
- `POST /v1/recipes`
- `GET /v1/recipes?query=...`
- `GET /v1/recipes/:recipeId`
- `PATCH /v1/recipes/:recipeId`
- `DELETE /v1/recipes/:recipeId`
- `GET /v1/meal-plans/day?date=YYYY-MM-DD`
- `GET /v1/meal-plans/history?date=YYYY-MM-DD`
- `POST /v1/meal-plans/day/entries`
- `DELETE /v1/meal-plans/day/entries/:entryId`
- `GET /v1/shopping-list`
- `GET /v1/shopping-list/categories`
- `POST /v1/shopping-list/categories`
- `PATCH /v1/shopping-list/categories/:categoryId`
- `DELETE /v1/shopping-list/categories/:categoryId`
- `POST /v1/shopping-list/items`
- `PATCH /v1/shopping-list/items/:itemId`
- `DELETE /v1/shopping-list/items/:itemId`

Recipe creation is one request only:
- single-step creation
- no separate ingredient add endpoint
- ingredients must reference existing products via `productId`

## MCP
- `GET /mcp`
- `POST /mcp`

Main tools:
- `product.search`
- `product.createManual`
- `recipe.create`
- `recipe.search`
- `recipe.get`
- `bodyMetrics.dayGet`
- `bodyMetrics.upsertDaily`
- `bodyMetrics.historyGet`
- `mealPlan.dayGet`
- `mealPlan.historyGet`
- `mealPlan.addEntry`
- `mealPlan.removeEntry`
- `shoppingList.get`
- `shoppingList.addCategory`
- `shoppingList.addItem`
- `shoppingList.setItemState`
- `shoppingList.removeItem`

### Example: create recipe
```bash
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer DEV_TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"recipe.create","arguments":{"title":"Omelette","ingredients":[{"productId":"prod_egg","amount":120,"unit":"g"}],"steps":["Beat eggs","Cook"]}}}'
```

### Example: add meal-plan entry
```bash
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer DEV_TOKEN" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"mealPlan.addEntry","arguments":{"date":"2026-02-20","slot":"BREAKFAST","productId":"prod_egg","amount":120,"unit":"g"}}}'
```

## Migrations
- Local: `npx prisma migrate dev`
- Prod: `npx prisma migrate deploy`
