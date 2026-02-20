import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { UsersService } from "../users/users.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async register(dto: RegisterDto) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new BadRequestException({
        code: "EMAIL_ALREADY_EXISTS",
        message: "Email is already registered",
      });
    }

    const passwordHash = this.hashPassword(dto.password);
    const user = await this.usersService.createWithEmail(email, passwordHash);
    const accessToken = this.issueAccessToken(user.id, user.email);

    return {
      accessToken,
      user: { id: user.id, email: user.email },
    };
  }

  async login(dto: LoginDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.passwordHash || !this.verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException({
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      });
    }

    const accessToken = this.issueAccessToken(user.id, user.email);
    return {
      accessToken,
      user: { id: user.id, email: user.email },
    };
  }

  issueAccessToken(userId: string, email: string) {
    const secret = this.getJwtSecret();
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: userId,
      email,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
    };

    const header = { alg: "HS256", typ: "JWT" };
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const signature = this.sign(`${encodedHeader}.${encodedPayload}`, secret);
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  verifyAccessToken(token: string) {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new UnauthorizedException("Invalid access token");
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const secret = this.getJwtSecret();
    const expectedSignature = this.sign(`${encodedHeader}.${encodedPayload}`, secret);

    const lhs = Buffer.from(encodedSignature);
    const rhs = Buffer.from(expectedSignature);
    if (lhs.length !== rhs.length || !timingSafeEqual(lhs, rhs)) {
      throw new UnauthorizedException("Invalid access token");
    }

    let payload: { sub?: unknown; exp?: unknown; email?: unknown };
    try {
      payload = JSON.parse(this.base64UrlDecode(encodedPayload));
    } catch {
      throw new UnauthorizedException("Invalid access token");
    }

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new UnauthorizedException("Invalid access token");
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = Number(payload.exp);
    if (!Number.isFinite(exp) || exp <= now) {
      throw new UnauthorizedException("Access token expired");
    }

    return {
      userId: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
    };
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const derived = scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${derived}`;
  }

  private verifyPassword(password: string, hash: string) {
    const [salt, stored] = hash.split(":");
    if (!salt || !stored) {
      return false;
    }
    const derived = scryptSync(password, salt, 64).toString("hex");
    const lhs = Buffer.from(stored);
    const rhs = Buffer.from(derived);
    return lhs.length === rhs.length && timingSafeEqual(lhs, rhs);
  }

  private sign(value: string, secret: string) {
    const digest = createHmac("sha256", secret).update(value).digest("base64");
    return this.toBase64Url(digest);
  }

  private base64UrlEncode(value: string) {
    return this.toBase64Url(Buffer.from(value, "utf8").toString("base64"));
  }

  private base64UrlDecode(value: string) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    return Buffer.from(normalized + pad, "base64").toString("utf8");
  }

  private toBase64Url(value: string) {
    return value.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }

  private getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.trim().length < 16) {
      throw new BadRequestException("JWT_SECRET must be configured and at least 16 characters");
    }
    return secret;
  }
}
