# FoodieAI Backend (MVP)

NestJS + Prisma + Postgres (Neon) backend with REST + MCP (JSON-RPC) + OAuth.

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
```text
http://localhost:3000/docs
```

## Environment
Create `.env` from `.env.example`.
Key auth vars (dev):
- `AUTH_MODE=dev`
- `DEV_SUB=dev-user`
- `OAUTH_TOKEN_SECRET=...`
- `OAUTH_AUDIENCE=foodieai-mcp`

## REST Endpoints
- `GET /health` -> `{ "status": "ok" }`
- `POST /v1/products`
- `GET /v1/products?query=...`

## MCP (JSON-RPC v2)
- `GET /mcp` -> `{ "name": "FoodieAI MCP", "status": "ok" }`
- `POST /mcp`

### tools/list (public)
```bash
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### tools/call product.search (public)
```bash
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"product.search","arguments":{"query":"yogurt"}}}'
```

Example response:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"count\":1,\"items\":[{\"id\":\"prod_1\",\"name\":\"Salmon\",\"brand\":null,\"price\":null,\"currency\":null,\"store\":null,\"url\":null,\"image_url\":null,\"nutrition\":{\"kcal100\":208,\"protein100\":20,\"fat100\":13,\"carbs100\":0}}]}"
      }
    ],
    "isError": false
  }
}
```

### tools/call user.me (requires Bearer)
```bash
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"jsonrpc":"2.0","id":10,"method":"tools/call","params":{"name":"user.me","arguments":{}}}'
```

Example response:
```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "result": {
    "content": [
      { "type": "text", "text": "✅ User profile loaded" },
      { "type": "text", "text": "{\"user\":{\"id\":\"u1\"},\"profile\":null}" }
    ],
    "isError": false
  }
}
```

### tools/call userProfile.upsert (requires Bearer)
```bash
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"jsonrpc":"2.0","id":11,"method":"tools/call","params":{"name":"userProfile.upsert","arguments":{"firstName":"Ira","lastName":"Stefan","sex":"FEMALE","birthDate":"1994-05-10","heightCm":168,"weightKg":63,"activityLevel":"MODERATE","goal":"LOSE","calorieDelta":-400}}}'
```

### tools/call userTargets.recalculate (requires Bearer)
```bash
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"jsonrpc":"2.0","id":12,"method":"tools/call","params":{"name":"userTargets.recalculate","arguments":{}}}'
```

### tools/call product.createManual (requires Bearer)
```bash
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"product.createManual","arguments":{"name":"Salmon","kcal100":208,"protein100":20,"fat100":13,"carbs100":0}}}'
```

## OAuth (for ChatGPT connector)
DEV auth mode uses JWT access tokens with a fixed subject.

Discovery endpoints:
- `/.well-known/oauth-authorization-server`
- `/.well-known/oauth-authorization-server/mcp`
- `/.well-known/openid-configuration`
- `/.well-known/openid-configuration/mcp`

### Authorize
```bash
curl -i "http://localhost:3000/oauth/authorize?response_type=code&client_id=foodieai_mcp&redirect_uri=https://chatgpt.com/&state=abc&scope=tools"
```

### Token
```bash
curl -s -X POST http://localhost:3000/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=PASTE_CODE&redirect_uri=https://chatgpt.com/&client_id=foodieai_mcp&client_secret=changeme"
```

### MCP with Bearer token
```bash
curl -s -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

## Migrations
- Local: `npx prisma migrate dev`
- Prod: `npx prisma migrate deploy`

## Deploy (Cloud Run)
```bash
gcloud run deploy foodieai-backend \
  --source . \
  --region me-west1 \
  --set-env-vars DATABASE_URL=...,OAUTH_CLIENT_ID=...,OAUTH_CLIENT_SECRET=...,OAUTH_REDIRECT_URI=https://chatgpt.com/,OAUTH_ISSUER=https://your-service-domain
```
