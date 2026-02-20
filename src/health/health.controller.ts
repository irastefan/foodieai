import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

@ApiTags("health")
@Controller()
export class HealthController {
  // Simple liveness probe.
  @Get("health")
  @ApiOperation({
    summary: "Health check",
    description: "Lightweight liveness endpoint for uptime checks and load balancers.",
  })
  @ApiOkResponse({
    description: "Service is healthy",
    schema: {
      type: "object",
      properties: {
        status: { type: "string", example: "ok" },
      },
    },
  })
  getHealth() {
    return { status: "ok" };
  }
}
