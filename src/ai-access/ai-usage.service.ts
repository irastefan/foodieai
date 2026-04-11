import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { AiSubscriptionsService } from "./ai-subscriptions.service";

type UsageObject = {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
};

@Injectable()
export class AiUsageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: AiSubscriptionsService,
  ) {}

  async ensureCanExecute(
    userId: string,
    input: {
      feature: string;
      actionType: string;
      model?: string;
    },
  ) {
    const summary = await this.subscriptionsService.assertQuotaAvailable(userId, input.feature);
    return {
      ...summary,
      actionType: input.actionType,
      model: input.model ?? null,
    };
  }

  async recordUsage(
    userId: string,
    input: {
      actionType: string;
      feature?: string;
      model: string;
      usage: UsageObject;
    },
  ) {
    await this.subscriptionsService.ensureDefaultPlans();
    return this.prisma.$transaction(async (tx) => {
      const state = await this.subscriptionsService.getNormalizedState(tx as any, userId, new Date());
      const totalTokens = this.resolveTotalTokens(input.usage);
      const promptTokens = this.normalizeTokenValue(input.usage.prompt_tokens);
      const completionTokens = this.normalizeTokenValue(input.usage.completion_tokens);

      await (tx as any).aiUsageLog.create({
        data: {
          userId,
          subscriptionId: state.subscription.id,
          actionType: input.actionType,
          feature: input.feature ?? null,
          promptTokens,
          completionTokens,
          totalTokens,
          model: input.model,
        },
      });

      await (tx as any).userAiSubscription.update({
        where: { id: state.subscription.id },
        data: {
          tokensUsed: {
            increment: totalTokens,
          },
        },
      });

      const updatedState = await this.subscriptionsService.getNormalizedState(tx as any, userId, new Date());
      return this.subscriptionsService.buildUsageSummary(updatedState);
    });
  }

  private resolveTotalTokens(usage: UsageObject) {
    const total = this.normalizeTokenValue(usage.total_tokens);
    if (total > 0) {
      return total;
    }
    return this.normalizeTokenValue(usage.prompt_tokens) + this.normalizeTokenValue(usage.completion_tokens);
  }

  private normalizeTokenValue(value?: number | null) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      return 0;
    }
    return Math.round(value);
  }
}
