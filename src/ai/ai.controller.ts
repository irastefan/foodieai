import { AiUsageResponseDto } from "../ai-access/dto/ai-usage-response.dto";
import { Body, Controller, Headers, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiExtraModels, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthContextService } from "../auth/auth-context.service";
import { AiService } from "./ai.service";
import { CreateAiResponseDto } from "./dto/create-ai-response.dto";

@ApiTags("ai")
@ApiBearerAuth("bearer")
@ApiExtraModels(AiUsageResponseDto)
@Controller("v1/ai")
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly authContext: AuthContextService,
  ) {}

  @Post("responses")
  @ApiOperation({
    summary: "Proxy OpenAI Responses API via backend",
    description: "Checks AI feature access and quota, calls OpenAI Responses API, records token usage, and returns updated quota summary.",
  })
  @ApiBody({
    type: CreateAiResponseDto,
    examples: {
      basic: {
        summary: "Simple response request",
        value: {
          model: "gpt-5-mini",
          input: "Create a short high-protein breakfast idea",
          reasoning: { effort: "low" },
        },
      },
      withTools: {
        summary: "Request with explicit tools and previous response",
        value: {
          model: "gpt-5-mini",
          input: [{ role: "user", content: [{ type: "input_text", text: "Continue meal analysis" }] }],
          previous_response_id: "resp_123",
          tools: [{ type: "web_search_preview" }],
          reasoning: { effort: "low" },
        },
      },
      backendDefaultTools: {
        summary: "Request without tools, backend fills defaults",
        value: {
          model: "gpt-5-mini",
          input: "Find 3 breakfast ideas with current nutrition trends",
          reasoning: { effort: "low" },
        },
      },
    },
  })
  @ApiOkResponse({
    description: "OpenAI response plus updated AI quota summary",
    schema: {
      type: "object",
      properties: {
        response: {
          type: "object",
          additionalProperties: true,
        },
        aiUsage: {
          $ref: "#/components/schemas/AiUsageResponseDto",
        },
      },
    },
  })
  async createResponse(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: CreateAiResponseDto,
  ) {
    const userId = await this.authContext.getUserId(headers);
    return this.aiService.createResponse(userId, body);
  }
}
