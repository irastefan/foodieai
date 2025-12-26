import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthController {
  // Simple liveness probe.
  @Get("health")
  getHealth() {
    return { status: "ok" };
  }
}
