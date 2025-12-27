import assert from "assert";
import { AuthContextService } from "../src/auth/auth-context.service";
import { OauthService } from "../src/oauth/oauth.service";

class StubUsersService {
  async getOrCreateByExternalId(externalId: string) {
    return { id: `user_${externalId}` };
  }
}

const oauth = new OauthService();
const users = new StubUsersService();
const authContext = new AuthContextService(
  oauth,
  users as unknown as Parameters<typeof AuthContextService>[1],
);

const issued = oauth.issueAccessToken("client", "tools", "subject_1");
const userId = authContext.getOrCreateUserId({
  authorization: `Bearer ${issued.token}`,
});

Promise.resolve(userId).then((id) => {
  assert.strictEqual(id, "user_subject_1", "valid token should resolve user id");
  console.log("auth-context.test passed");
});
