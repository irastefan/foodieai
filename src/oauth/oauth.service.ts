import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";

type AuthCodeRecord = {
  clientId: string;
  redirectUri: string;
  scope?: string;
  expiresAt: number;
  subject: string;
};

type AccessTokenRecord = {
  clientId: string;
  scope?: string;
  expiresAt: number;
  subject: string;
};

@Injectable()
export class OauthService {
  // In-memory OAuth codes and access tokens (MVP, non-persistent).
  private readonly codes = new Map<string, AuthCodeRecord>();
  private readonly tokens = new Map<string, AccessTokenRecord>();

  // Create a short-lived authorization code.
  createAuthCode(
    clientId: string,
    redirectUri: string,
    scope?: string,
    subject?: string,
  ) {
    const code = randomUUID();
    const resolvedSubject = subject ?? randomUUID();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    this.codes.set(code, {
      clientId,
      redirectUri,
      scope,
      expiresAt,
      subject: resolvedSubject,
    });
    return code;
  }

  // Validate and consume an auth code (one-time use).
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

  // Issue a short-lived access token.
  issueAccessToken(clientId: string, scope?: string, subject?: string) {
    const token = randomUUID();
    const expiresAt = Date.now() + 60 * 60 * 1000;
    this.tokens.set(token, {
      clientId,
      scope,
      expiresAt,
      subject: subject ?? randomUUID(),
    });
    return { token, expiresAt };
  }

  // Validate access token.
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

  getSubjectFromToken(token: string) {
    const record = this.validateAccessToken(token);
    return record?.subject ?? null;
  }
}
