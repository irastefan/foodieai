import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { OauthService } from "../oauth/oauth.service";
import { UsersService } from "../users/users.service";

@Injectable()
export class AuthContextService {
  // Resolves the current user from a Bearer token.
  constructor(
    private readonly oauthService: OauthService,
    private readonly usersService: UsersService,
  ) {}

  async getOrCreateUserId(headers: Record<string, string | string[] | undefined>) {
    this.logAuthPresence(headers);
    const token = this.extractBearerToken(headers);
    const subject = this.resolveSubject(token);
    const user = await this.usersService.getOrCreateByExternalId(subject);
    return user.id;
  }

  private extractBearerToken(headers: Record<string, string | string[] | undefined>) {
    const raw = headers["authorization"];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (!value && process.env.DEV_AUTH_BYPASS_SUB) {
      return "";
    }
    if (!value || !value.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing Bearer token");
    }
    const token = value.slice("Bearer ".length).trim();
    if (!token) {
      throw new UnauthorizedException("Missing Bearer token");
    }
    return token;
  }

  private resolveSubject(token: string) {
    if (!token && process.env.DEV_AUTH_BYPASS_SUB) {
      return process.env.DEV_AUTH_BYPASS_SUB;
    }
    const stored = this.oauthService.getSubjectFromToken(token);
    if (stored) {
      return stored;
    }

    const jwtSubject = this.tryDecodeJwtSubject(token);
    if (jwtSubject) {
      return jwtSubject;
    }

    if (process.env.DEV_AUTH_BYPASS_SUB) {
      return process.env.DEV_AUTH_BYPASS_SUB;
    }
    throw new UnauthorizedException("Invalid access token");
  }

  private tryDecodeJwtSubject(token: string) {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }
    try {
      const payload = this.base64UrlDecode(parts[1]);
      const parsed = JSON.parse(payload) as { sub?: unknown };
      if (typeof parsed.sub === "string" && parsed.sub.length > 0) {
        return parsed.sub;
      }
      return null;
    } catch {
      return null;
    }
  }

  private base64UrlDecode(input: string) {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    return Buffer.from(normalized + pad, "base64").toString("utf8");
  }

  private logAuthPresence(headers: Record<string, string | string[] | undefined>) {
    const raw = headers["authorization"];
    const value = Array.isArray(raw) ? raw[0] : raw;
    const hasAuth = Boolean(value);
    Logger.log(`MCP auth header present: ${hasAuth}`, AuthContextService.name);
  }
}
