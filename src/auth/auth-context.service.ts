import { Injectable, UnauthorizedException } from "@nestjs/common";
import { UsersService } from "../users/users.service";
import { AuthService } from "./auth.service";

@Injectable()
export class AuthContextService {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  async getUserId(headers: Record<string, string | string[] | undefined>) {
    const token = this.extractBearerToken(headers);
    const payload = this.authService.verifyAccessToken(token);
    const user = await this.usersService.getById(payload.userId);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    return user.id;
  }

  async getOptionalUserId(headers: Record<string, string | string[] | undefined>) {
    const raw = headers["authorization"];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (!value) {
      return undefined;
    }
    return this.getUserId(headers);
  }

  private extractBearerToken(headers: Record<string, string | string[] | undefined>) {
    const raw = headers["authorization"];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (!value || !value.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing Bearer token");
    }
    const token = value.slice("Bearer ".length).trim();
    if (!token) {
      throw new UnauthorizedException("Missing Bearer token");
    }
    return token;
  }
}
