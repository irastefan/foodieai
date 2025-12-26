import { Controller, Get, Headers } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

@ApiTags("oauth")
@Controller()
export class OauthDiscoveryController {
  // OAuth discovery document used by MCP clients.
  @Get(".well-known/oauth-authorization-server")
  @ApiOperation({
    summary: "OAuth discovery",
    description: "Returns OAuth authorization server metadata (RFC 8414).",
  })
  oauthAuthorizationServer(
    @Headers("x-forwarded-proto") forwardedProto: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Headers("host") host: string | undefined,
  ) {
    const baseUrl = this.getBaseUrl(forwardedProto, forwardedHost, host);
    return {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      token_endpoint_auth_methods_supported: [
        "client_secret_post",
        "client_secret_basic",
      ],
      scopes_supported: ["tools"],
    };
  }

  // Same discovery doc with /mcp suffix (client-specific path).
  @Get(".well-known/oauth-authorization-server/mcp")
  @ApiOperation({
    summary: "OAuth discovery (MCP path)",
    description: "Same metadata as oauth-authorization-server for MCP clients.",
  })
  oauthAuthorizationServerForMcp(
    @Headers("x-forwarded-proto") forwardedProto: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Headers("host") host: string | undefined,
  ) {
    return this.oauthAuthorizationServer(forwardedProto, forwardedHost, host);
  }

  // OIDC discovery document (subset) for clients expecting it.
  @Get(".well-known/openid-configuration")
  @ApiOperation({
    summary: "OpenID discovery",
    description: "Returns a minimal OpenID configuration document.",
  })
  openIdConfiguration(
    @Headers("x-forwarded-proto") forwardedProto: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Headers("host") host: string | undefined,
  ) {
    const baseUrl = this.getBaseUrl(forwardedProto, forwardedHost, host);
    return {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      token_endpoint_auth_methods_supported: [
        "client_secret_post",
        "client_secret_basic",
      ],
      scopes_supported: ["tools"],
    };
  }

  // Same OIDC discovery doc with /mcp suffix (client-specific path).
  @Get(".well-known/openid-configuration/mcp")
  @ApiOperation({
    summary: "OpenID discovery (MCP path)",
    description: "Same OpenID metadata for MCP clients.",
  })
  openIdConfigurationForMcp(
    @Headers("x-forwarded-proto") forwardedProto: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Headers("host") host: string | undefined,
  ) {
    return this.openIdConfiguration(forwardedProto, forwardedHost, host);
  }

  private getBaseUrl(
    forwardedProto: string | undefined,
    forwardedHost: string | undefined,
    host: string | undefined,
  ) {
    if (process.env.OAUTH_ISSUER) {
      return process.env.OAUTH_ISSUER.replace(/\/$/, "");
    }
    const proto = forwardedProto?.split(",")[0]?.trim() || "https";
    const hostname = forwardedHost?.split(",")[0]?.trim() || host || "localhost";
    return `${proto}://${hostname}`;
  }
}
