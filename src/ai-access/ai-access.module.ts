import { Module } from "@nestjs/common";
import { AiSubscriptionsService } from "./ai-subscriptions.service";
import { AiUsageService } from "./ai-usage.service";

@Module({
  providers: [AiSubscriptionsService, AiUsageService],
  exports: [AiSubscriptionsService, AiUsageService],
})
export class AiAccessModule {}
