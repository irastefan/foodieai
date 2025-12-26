import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";

type AuthCodeRecord = {
  clientId: string;
  redirectUri: string;
  scope?: string;
  expiresAt: number;
};

type AccessTokenRecord = {
  clientId: string;
  scope?: string;
  expiresAt: number;
};

@Injectable()
export class OauthService {
  private readonly codes = new Map<string, AuthCodeRecord>();
  private readonly tokens = new Map<string, AccessTokenRecord>();

  createAuthCode(clientId: string, redirectUri: string, scope?: string) {
    const code = randomUUID();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    this.codes.set(code, { clientId, redirectUri, scope, expiresAt });
    return code;
  }

  consumeAuthCode(code: string, clientId: string, redirectUri: string) {
    const record = this.codes.get(code);
    if (!record) {
      return null;
    }
    if (record.expiresAt < Date.now()) {
      this.codes.delete(code);
      return null;
    }
    if (record.clientId !== clientId || record.redirectUri !== redirectUri) {
      return null;
    }
    this.codes.delete(code);
    return record;
  }

  issueAccessToken(clientId: string, scope?: string) {
    const token = randomUUID();
    const expiresAt = Date.now() + 60 * 60 * 1000;
    this.tokens.set(token, { clientId, scope, expiresAt });
    return { token, expiresAt };
  }

  validateAccessToken(token: string) {
    const record = this.tokens.get(token);
    if (!record) {
      return null;
    }
    if (record.expiresAt < Date.now()) {
      this.tokens.delete(token);
      return null;
    }
    return record;
  }
}
