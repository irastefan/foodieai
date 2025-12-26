import { Body, Controller, Get, Headers, Post, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
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

    const code = this.oauthService.createAuthCode(clientId, redirectUri, scope);
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
  token(
    @Body() body: Record<string, string | undefined>,
    @Headers("authorization") authorization: string | undefined,
    @Res() res: Response,
  ) {
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

    const issued = this.oauthService.issueAccessToken(
      record.clientId,
      record.scope,
    );

    return res.json({
      access_token: issued.token,
      token_type: "Bearer",
      expires_in: 3600,
      scope: record.scope ?? "",
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
