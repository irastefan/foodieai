import { AiUsageResponseDto } from "../ai-access/dto/ai-usage-response.dto";
import { Body, Controller, Headers, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { AuthContextService } from "../auth/auth-context.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { AiService } from "./ai.service";
import { CreateAiResponseDto } from "./dto/create-ai-response.dto";
import { UploadAiImageResponseDto } from "./dto/upload-ai-image-response.dto";
import { AiImageUploadService } from "./ai-image-upload.service";

const uploadFileLimit = Number.parseInt(process.env.GCS_UPLOAD_MAX_FILE_BYTES?.trim() || "", 10);
const multerFileSizeLimit = Number.isFinite(uploadFileLimit) && uploadFileLimit > 0
  ? uploadFileLimit
  : 10 * 1024 * 1024;

@ApiTags("ai")
@ApiBearerAuth("bearer")
@ApiExtraModels(AiUsageResponseDto, UploadAiImageResponseDto)
@Controller("v1/ai")
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly authContext: AuthContextService,
    private readonly aiImageUploadService: AiImageUploadService,
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

  @Post("uploads/image")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: {
        fileSize: multerFileSizeLimit,
        files: 1,
      },
    }),
  )
  @ApiOperation({
    summary: "Upload image for AI requests",
    description: "Stores an image in Google Cloud Storage and returns a URL that can be passed to OpenAI instead of base64 data.",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @ApiOkResponse({
    description: "Uploaded image metadata and URL",
    type: UploadAiImageResponseDto,
  })
  async uploadImage(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    const userId = await this.authContext.getUserId(headers);
    return this.aiImageUploadService.uploadImage(userId, file);
  }
}
