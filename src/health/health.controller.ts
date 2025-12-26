import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

@ApiTags("health")
@Controller()
export class HealthController {
  // Simple liveness probe.
  @Get("health")
  @ApiOperation({
    summary: "Health check",
    description: "Lightweight liveness endpoint for uptime checks and load balancers.",
  })
  getHealth() {
    return { status: "ok" };
  }
}
