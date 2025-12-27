import { Body, Controller, Get, Headers, Post, Query, Res } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import jwt from "jsonwebtoken";
import { OauthService } from "./oauth.service";

@ApiTags("oauth")
@Controller("oauth")
export class OauthController {
  // Minimal OAuth endpoints for ChatGPT connector (auth code + token).
  constructor(private readonly oauthService: OauthService) {}

  // Authorization endpoint: issues short-lived auth code.
  @Get("authorize")
  @ApiOperation({
    summary: "OAuth authorize",
    description:
      "Issues a short-lived authorization code and redirects to redirect_uri with code and state.",
  })
  authorize(
    @Query() query: Record<string, string | undefined>,
    @Res() res: Response,
  ) {
    const authMode = process.env.AUTH_MODE || "dev";
    // TODO: Replace DEV auth with real login (email OTP) in production.
    const clientId = query.client_id;
    const redirectUri = query.redirect_uri;
    const responseType = query.response_type;
    const state = query.state;
    const scope = query.scope;

    if (!clientId || !redirectUri || responseType !== "code") {
      return res.status(400).json({
        error: "invalid_request",
        error_description: "Missing or invalid parameters",
      });
    }

    const subject =
      authMode === "dev"
        ? process.env.DEV_SUB || "dev-user"
        : undefined;
    const code = this.oauthService.createAuthCode(
      clientId,
      redirectUri,
      scope,
      subject,
    );
    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set("code", code);
    if (state) {
      redirectUrl.searchParams.set("state", state);
    }

    return res.redirect(302, redirectUrl.toString());
  }

  @Post("token")
  // Token endpoint: exchanges auth code for access token.
  @ApiOperation({
    summary: "OAuth token",
    description:
      "Exchanges an authorization code for a short-lived access token (Bearer).",
  })
  @ApiBody({
    schema: { type: "object" },
    examples: {
      tokenExchange: {
        summary: "Exchange auth code",
        value: {
          grant_type: "authorization_code",
          code: "PASTE_CODE",
          client_id: "foodieai",
        },
      },
    },
  })
  token(
    @Body() body: Record<string, string | undefined>,
    @Headers("authorization") authorization: string | undefined,
    @Res() res: Response,
  ) {
    const authMode = process.env.AUTH_MODE || "dev";
    const grantType = body.grant_type;
    const code = body.code;
    const redirectUri = body.redirect_uri;
    const auth = this.decodeBasicAuth(authorization);
    const clientId = body.client_id ?? auth?.username;
    const clientSecret = body.client_secret ?? auth?.password;

    if (
      grantType !== "authorization_code" ||
      !code ||
      !redirectUri ||
      !clientId ||
      !clientSecret
    ) {
      return res.status(400).json({
        error: "invalid_request",
        error_description: "Missing or invalid parameters",
      });
    }

    const record = this.oauthService.consumeAuthCode(code, clientId, redirectUri);
    if (!record) {
      return res.status(400).json({
        error: "invalid_grant",
        error_description: "Invalid or expired code",
      });
    }

    const secret = process.env.OAUTH_TOKEN_SECRET;
    if (!secret) {
      return res.status(500).json({
        error: "server_error",
        error_description: "Missing OAUTH_TOKEN_SECRET",
      });
    }

    const audience = process.env.OAUTH_AUDIENCE || "foodieai-mcp";
    const scopeValue = "mcp";
    const sub =
      authMode === "dev"
        ? process.env.DEV_SUB || record.subject
        : record.subject;

    const accessToken = jwt.sign(
      {
        sub,
        aud: audience,
        scope: scopeValue,
      },
      secret,
      {
        algorithm: "HS256",
        expiresIn: 3600,
      },
    );

    return res.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      scope: scopeValue,
    });
  }

  private decodeBasicAuth(header: string | undefined) {
    if (!header || !header.startsWith("Basic ")) {
      return null;
    }
    const base64 = header.slice("Basic ".length);
    const decoded = Buffer.from(base64, "base64").toString("utf8");
    const [username, password] = decoded.split(":", 2);
    if (!username || !password) {
      return null;
    }
    return { username, password };
  }
}
