import { Body, Controller, Post } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { AuthResponseDto } from "./dto/auth-response.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@ApiTags("auth")
@Controller("v1/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @ApiOperation({ summary: "Register user" })
  @ApiBody({
    type: RegisterDto,
    examples: {
      register: {
        summary: "Register",
        value: { email: "ira@example.com", password: "StrongPass123" },
      },
    },
  })
  @ApiOkResponse({
    description: "Registered user with access token",
    type: AuthResponseDto,
  })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  @ApiOperation({ summary: "Login user" })
  @ApiBody({
    type: LoginDto,
    examples: {
      login: {
        summary: "Login",
        value: { email: "ira@example.com", password: "StrongPass123" },
      },
    },
  })
  @ApiOkResponse({
    description: "Logged in user with access token",
    type: AuthResponseDto,
  })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
