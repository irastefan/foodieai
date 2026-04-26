import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthCodePurpose } from "@prisma/client";
import { createHash, createHmac, randomInt, timingSafeEqual } from "crypto";
import { PrismaService } from "../common/prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { RequestEmailCodeDto } from "./dto/request-email-code.dto";
import { VerifyEmailCodeDto } from "./dto/verify-email-code.dto";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const EMAIL_CODE_TTL_MINUTES = 10;
const MAX_VERIFY_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  async requestRegisterCode(dto: RequestEmailCodeDto) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new BadRequestException({
        code: "EMAIL_ALREADY_EXISTS",
        message: "Email is already registered",
      });
    }

    const code = await this.createEmailCode(email, AuthCodePurpose.REGISTER);
    await this.sendCodeToEmail(email, code, "registration");
    return { ok: true };
  }

  async register(dto: VerifyEmailCodeDto) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new BadRequestException({
        code: "EMAIL_ALREADY_EXISTS",
        message: "Email is already registered",
      });
    }

    await this.verifyEmailCode(email, dto.code, AuthCodePurpose.REGISTER);
    const user = await this.usersService.createWithEmail(email);
    const accessToken = this.issueAccessToken(user.id, user.email);

    return {
      accessToken,
      user: { id: user.id, email: user.email },
    };
  }

  async requestLoginCode(dto: RequestEmailCodeDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException({
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or code",
      });
    }

    const code = await this.createEmailCode(email, AuthCodePurpose.LOGIN);
    await this.sendCodeToEmail(email, code, "login");
    return { ok: true };
  }

  async login(dto: VerifyEmailCodeDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException({
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or code",
      });
    }

    await this.verifyEmailCode(email, dto.code, AuthCodePurpose.LOGIN);

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

  private async createEmailCode(email: string, purpose: AuthCodePurpose) {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MINUTES * 60_000);

    await (this.prisma as any).authEmailCode.deleteMany({ where: { email, purpose } });
    await (this.prisma as any).authEmailCode.create({
      data: {
        email,
        purpose,
        codeHash: this.hashCode(code),
        expiresAt,
      },
    });

    return code;
  }

  private async verifyEmailCode(email: string, code: string, purpose: AuthCodePurpose) {
    const record = await (this.prisma as any).authEmailCode.findUnique({
      where: {
        email_purpose: { email, purpose },
      },
    });

    if (!record || record.expiresAt.getTime() < Date.now()) {
      if (record) {
        await (this.prisma as any).authEmailCode.delete({ where: { id: record.id } });
      }
      throw new UnauthorizedException({
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or code",
      });
    }

    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      await (this.prisma as any).authEmailCode.delete({ where: { id: record.id } });
      throw new UnauthorizedException({
        code: "TOO_MANY_ATTEMPTS",
        message: "Too many invalid attempts. Request a new code",
      });
    }

    if (record.codeHash !== this.hashCode(code)) {
      await (this.prisma as any).authEmailCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException({
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or code",
      });
    }

    await (this.prisma as any).authEmailCode.delete({ where: { id: record.id } });
  }

  private generateCode() {
    return String(randomInt(0, 1_000_000)).padStart(6, "0");
  }

  private hashCode(code: string) {
    const salt = this.getEmailCodeSalt();
    return createHash("sha256").update(`${salt}:${code}`).digest("hex");
  }

  private async sendCodeToEmail(email: string, code: string, purpose: "registration" | "login") {
    const subject = `FoodieAI ${purpose} code`;
    const text = `Your FoodieAI ${purpose} code is ${code}. It expires in ${EMAIL_CODE_TTL_MINUTES} minutes.`;
    const webhookUrl = process.env.AUTH_EMAIL_WEBHOOK_URL?.trim();

    if (!webhookUrl) {
      console.info("[auth] AUTH_EMAIL_WEBHOOK_URL is not set. Email code fallback log", {
        email,
        purpose,
        code,
      });
      return;
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: email, subject, text, purpose }),
    });

    if (!response.ok) {
      throw new BadRequestException("Failed to send one-time code to email");
    }
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

  private getEmailCodeSalt() {
    const secret = process.env.AUTH_CODE_SALT?.trim() || process.env.JWT_SECRET?.trim();
    if (!secret || secret.length < 16) {
      throw new BadRequestException("AUTH_CODE_SALT or JWT_SECRET must be configured and at least 16 characters");
    }
    return secret;
  }
}
