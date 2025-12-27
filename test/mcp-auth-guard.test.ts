import assert from "assert";
import jwt from "jsonwebtoken";
import { McpAuthGuard } from "../src/auth/mcp-auth.guard";

class StubUsersService {
  async getOrCreateByExternalId(externalId: string) {
    return { id: `user_${externalId}` };
  }
}

process.env.OAUTH_TOKEN_SECRET = "test-secret";
process.env.OAUTH_AUDIENCE = "foodieai-mcp";

const token = jwt.sign(
  {
    sub: "dev-user",
    aud: "foodieai-mcp",
    scope: "mcp",
  },
  process.env.OAUTH_TOKEN_SECRET,
  { algorithm: "HS256", expiresIn: 3600 },
);

const guard = new McpAuthGuard(new StubUsersService() as never);

const req = {
  headers: { authorization: `Bearer ${token}` },
} as { headers: Record<string, string>; user?: unknown };

const context = {
  switchToHttp: () => ({
    getRequest: () => req,
  }),
} as never;

Promise.resolve(guard.canActivate(context)).then((result) => {
  assert.strictEqual(result, true, "guard should allow valid token");
  assert.ok(req.user, "user should be attached");
  console.log("mcp-auth-guard.test passed");
});
