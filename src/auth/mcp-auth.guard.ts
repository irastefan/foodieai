import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import jwt from "jsonwebtoken";
import { UsersService } from "../users/users.service";

type TokenPayload = {
  sub?: string;
  aud?: string | string[];
  scope?: string;
};

@Injectable()
export class McpAuthGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing Bearer token");
    }
    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      throw new UnauthorizedException("Missing Bearer token");
    }

    const secret = process.env.OAUTH_TOKEN_SECRET;
    if (!secret) {
      throw new UnauthorizedException("Missing token secret");
    }
    const audience = process.env.OAUTH_AUDIENCE || "foodieai-mcp";

    let payload: TokenPayload;
    try {
      payload = jwt.verify(token, secret, { audience }) as TokenPayload;
    } catch {
      throw new UnauthorizedException("Invalid access token");
    }

    if (!payload.sub || typeof payload.sub !== "string") {
      throw new UnauthorizedException("Invalid access token");
    }

    const user = await this.usersService.getOrCreateByExternalId(payload.sub);
    request.user = { userId: user.id, externalId: payload.sub };
    return true;
  }
}
