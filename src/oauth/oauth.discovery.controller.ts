import { Controller, Get, Headers } from "@nestjs/common";

@Controller()
export class OauthDiscoveryController {
  @Get(".well-known/oauth-authorization-server")
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

  @Get(".well-known/oauth-authorization-server/mcp")
  oauthAuthorizationServerForMcp(
    @Headers("x-forwarded-proto") forwardedProto: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Headers("host") host: string | undefined,
  ) {
    return this.oauthAuthorizationServer(forwardedProto, forwardedHost, host);
  }

  @Get(".well-known/openid-configuration")
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

  @Get(".well-known/openid-configuration/mcp")
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
