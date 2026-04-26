import { Body, Controller, Post } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { AuthResponseDto } from "./dto/auth-response.dto";
import { RequestEmailCodeDto } from "./dto/request-email-code.dto";
import { VerifyEmailCodeDto } from "./dto/verify-email-code.dto";

@ApiTags("auth")
@Controller("v1/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register/request-code")
  @ApiOperation({ summary: "Send one-time code for registration" })
  @ApiBody({
    type: RequestEmailCodeDto,
    examples: {
      register: {
        summary: "Send registration code",
        value: { email: "ira@example.com" },
      },
    },
  })
  @ApiOkResponse({
    description: "Code delivery request accepted",
    schema: {
      type: "object",
      properties: {
        ok: { type: "boolean", example: true },
      },
    },
  })
  async requestRegisterCode(@Body() dto: RequestEmailCodeDto) {
    return this.authService.requestRegisterCode(dto);
  }

  @Post("register")
  @ApiOperation({ summary: "Register user using one-time email code" })
  @ApiBody({
    type: VerifyEmailCodeDto,
    examples: {
      register: {
        summary: "Register with code",
        value: { email: "ira@example.com", code: "123456" },
      },
    },
  })
  @ApiOkResponse({
    description: "Registered user with access token",
    type: AuthResponseDto,
  })
  async register(@Body() dto: VerifyEmailCodeDto) {
    return this.authService.register(dto);
  }

  @Post("login/request-code")
  @ApiOperation({ summary: "Send one-time code for login" })
  @ApiBody({
    type: RequestEmailCodeDto,
    examples: {
      login: {
        summary: "Send login code",
        value: { email: "ira@example.com" },
      },
    },
  })
  @ApiOkResponse({
    description: "Code delivery request accepted",
    schema: {
      type: "object",
      properties: {
        ok: { type: "boolean", example: true },
      },
    },
  })
  async requestLoginCode(@Body() dto: RequestEmailCodeDto) {
    return this.authService.requestLoginCode(dto);
  }

  @Post("login")
  @ApiOperation({ summary: "Login user using one-time email code" })
  @ApiBody({
    type: VerifyEmailCodeDto,
    examples: {
      login: {
        summary: "Login with code",
        value: { email: "ira@example.com", code: "123456" },
      },
    },
  })
  @ApiOkResponse({
    description: "Logged in user with access token",
    type: AuthResponseDto,
  })
  async login(@Body() dto: VerifyEmailCodeDto) {
    return this.authService.login(dto);
  }
}
