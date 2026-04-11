import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import {
  AiFeature,
  DEFAULT_AI_ACTION_TOKEN_UNIT,
  DEFAULT_FREE_PLAN_CODE,
  DEFAULT_PAID_PLAN_CODE,
  DEFAULT_TRIAL_DAYS,
  DEFAULT_TRIAL_TOKEN_LIMIT,
  SubscriptionStatus,
} from "./ai-access.constants";

type TxLike = PrismaService | any;

export type AiPlanSummary = {
  id: string;
  name: string;
  code: string;
  monthlyTokenLimit: number;
  monthlyAiActions: number | null;
  priceCents: number;
  currency: string;
  isActive: boolean;
};

export type AiUsageSummary = {
  subscriptionStatus: string;
  currentPlan: AiPlanSummary;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  tokensUsed: number;
  tokensLimit: number;
  tokensRemaining: number;
  aiActionsUsed: number;
  aiActionsRemaining: number;
  availableFeatures: string[];
  trialStartedAt: string | null;
  trialEndsAt: string | null;
};

@Injectable()
export class AiSubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async initializeForNewUser(userId: string) {
    await this.ensureDefaultPlans();
    const existing = await (this.prisma as any).userAiSubscription.findUnique({
      where: { userId },
    });
    if (existing) {
      return existing;
    }
    return this.createInitialSubscription(this.prisma, userId, new Date());
  }

  async getUsageSummary(userId: string) {
    await this.ensureDefaultPlans();
    const state = await this.getNormalizedState(this.prisma, userId, new Date());
    return this.toUsageSummary(state);
  }

  async assertFeatureAccess(userId: string, feature: string) {
    const summary = await this.getUsageSummary(userId);
    if (!summary.availableFeatures.includes(feature)) {
      throw new ForbiddenException({
        code: "AI_FEATURE_NOT_AVAILABLE",
        message: "AI feature is not available for the current plan",
        feature,
        availableFeatures: summary.availableFeatures,
      });
    }
    return summary;
  }

  async assertQuotaAvailable(userId: string, feature: string) {
    const summary = await this.assertFeatureAccess(userId, feature);
    if (summary.tokensRemaining <= 0) {
      throw new ForbiddenException({
        code: "AI_QUOTA_EXCEEDED",
        message: "Monthly AI quota exceeded",
        feature,
        tokensRemaining: 0,
      });
    }
    return summary;
  }

  async setSubscriptionStatus(
    userId: string,
    input: {
      subscriptionStatus: string;
      planCode?: string;
      tokensLimit?: number | null;
      trialEndsAt?: Date | null;
    },
  ) {
    await this.ensureDefaultPlans();
    const plan = input.planCode
      ? await this.getPlanByCode(this.prisma, input.planCode)
      : await this.getFallbackPlan(this.prisma, input.subscriptionStatus);
    const period = this.createPeriod(new Date());

    await (this.prisma as any).userAiSubscription.upsert({
      where: { userId },
      create: {
        userId,
        subscriptionStatus: input.subscriptionStatus,
        planId: plan.id,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        tokensUsed: 0,
        tokensLimit: input.tokensLimit ?? plan.monthlyTokenLimit,
        trialStartedAt: input.subscriptionStatus === SubscriptionStatus.TRIAL ? new Date() : null,
        trialEndsAt: input.trialEndsAt ?? null,
        trialTokenLimit: input.subscriptionStatus === SubscriptionStatus.TRIAL
          ? (input.tokensLimit ?? this.getTrialTokenLimit())
          : null,
      },
      update: {
        subscriptionStatus: input.subscriptionStatus,
        planId: plan.id,
        tokensLimit: input.tokensLimit ?? plan.monthlyTokenLimit,
        trialEndsAt: input.trialEndsAt ?? undefined,
        trialTokenLimit: input.subscriptionStatus === SubscriptionStatus.TRIAL
          ? (input.tokensLimit ?? this.getTrialTokenLimit())
          : null,
      },
    });
  }

  async ensureDefaultPlans() {
    const freePlan = {
      id: "plan_free",
      name: "Free",
      code: DEFAULT_FREE_PLAN_CODE,
      monthlyTokenLimit: 25_000,
      monthlyAiActions: 5,
      priceCents: 0,
      currency: "USD",
      isActive: true,
      features: [
        AiFeature.MEAL_ANALYSIS,
        AiFeature.SMART_PRODUCT_MATCH,
      ],
    };
    const proPlan = {
      id: "plan_pro",
      name: "Pro",
      code: DEFAULT_PAID_PLAN_CODE,
      monthlyTokenLimit: 500_000,
      monthlyAiActions: 100,
      priceCents: 999,
      currency: "USD",
      isActive: true,
      features: [
        AiFeature.RECIPE_GENERATION,
        AiFeature.MEAL_ANALYSIS,
        AiFeature.SMART_PRODUCT_MATCH,
        AiFeature.ADVANCED_AI_TOOLS,
      ],
    };

    await this.upsertPlan(this.prisma, freePlan);
    await this.upsertPlan(this.prisma, proPlan);
  }

  async getNormalizedState(tx: TxLike, userId: string, now: Date) {
    let subscription = await this.findSubscription(tx, userId);
    if (!subscription) {
      await this.createInitialSubscription(tx, userId, now);
      subscription = await this.findSubscription(tx, userId);
    }
    if (!subscription) {
      throw new NotFoundException("AI subscription not found");
    }

    const nextState = await this.normalizeState(tx, subscription, now);
    return nextState;
  }

  private async normalizeState(tx: TxLike, subscription: any, now: Date) {
    const updates: Record<string, unknown> = {};
    let status = subscription.subscriptionStatus;

    if (
      status === SubscriptionStatus.TRIAL &&
      subscription.trialEndsAt &&
      new Date(subscription.trialEndsAt).getTime() <= now.getTime()
    ) {
      const freePlan = await this.getPlanByCode(tx, this.getDefaultFreePlanCode());
      status = SubscriptionStatus.FREE;
      updates.subscriptionStatus = status;
      updates.planId = freePlan.id;
      updates.trialEndsAt = subscription.trialEndsAt;
    }

    let effectivePlan = await this.getEffectivePlan(tx, status, subscription.plan?.code);
    const needsPeriodReset =
      !subscription.currentPeriodStart ||
      !subscription.currentPeriodEnd ||
      new Date(subscription.currentPeriodEnd).getTime() <= now.getTime();

    if (needsPeriodReset) {
      const period = this.createPeriod(now);
      updates.currentPeriodStart = period.start;
      updates.currentPeriodEnd = period.end;
      updates.tokensUsed = 0;
    }

    const nextTokensLimit = this.resolveTokensLimit(
      status,
      effectivePlan.monthlyTokenLimit,
      subscription.trialTokenLimit,
    );
    if (subscription.tokensLimit !== nextTokensLimit) {
      updates.tokensLimit = nextTokensLimit;
    }

    if (Object.keys(updates).length > 0) {
      await tx.userAiSubscription.update({
        where: { id: subscription.id },
        data: updates,
      });
      subscription = await this.findSubscription(tx, subscription.userId);
      effectivePlan = await this.getEffectivePlan(tx, subscription.subscriptionStatus, subscription.plan?.code);
    }

    return { subscription, effectivePlan };
  }

  buildUsageSummary(state: { subscription: any; effectivePlan: any }) {
    return this.toUsageSummary(state);
  }

  private async findSubscription(tx: TxLike, userId: string) {
    return tx.userAiSubscription.findUnique({
      where: { userId },
      include: {
        plan: {
          include: {
            features: true,
          },
        },
      },
    });
  }

  private async getEffectivePlan(tx: TxLike, status: string, planCode?: string | null) {
    if (status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.TRIAL) {
      return this.getPlanByCode(tx, planCode ?? this.getDefaultPaidPlanCode());
    }
    return this.getPlanByCode(tx, this.getDefaultFreePlanCode());
  }

  private async getFallbackPlan(tx: TxLike, status: string) {
    if (status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.TRIAL) {
      return this.getPlanByCode(tx, this.getDefaultPaidPlanCode());
    }
    return this.getPlanByCode(tx, this.getDefaultFreePlanCode());
  }

  private async getPlanByCode(tx: TxLike, code: string) {
    const plan = await tx.aiPlan.findUnique({
      where: { code },
      include: { features: true },
    });
    if (!plan) {
      throw new NotFoundException(`AI plan not found: ${code}`);
    }
    return plan;
  }

  private async upsertPlan(
    tx: TxLike,
    input: {
      id: string;
      name: string;
      code: string;
      monthlyTokenLimit: number;
      monthlyAiActions: number;
      priceCents: number;
      currency: string;
      isActive: boolean;
      features: string[];
    },
  ) {
    const plan = await tx.aiPlan.upsert({
      where: { code: input.code },
      create: {
        id: input.id,
        name: input.name,
        code: input.code,
        monthlyTokenLimit: input.monthlyTokenLimit,
        monthlyAiActions: input.monthlyAiActions,
        priceCents: input.priceCents,
        currency: input.currency,
        isActive: input.isActive,
      },
      update: {
        name: input.name,
        monthlyTokenLimit: input.monthlyTokenLimit,
        monthlyAiActions: input.monthlyAiActions,
        priceCents: input.priceCents,
        currency: input.currency,
        isActive: input.isActive,
      },
    });

    await tx.aiPlanFeature.deleteMany({ where: { planId: plan.id } });
    if (input.features.length > 0) {
      await tx.aiPlanFeature.createMany({
        data: input.features.map((feature) => ({
          id: `${plan.id}_${feature}`.toLowerCase(),
          planId: plan.id,
          feature,
        })),
        skipDuplicates: true,
      });
    }
  }

  private async createInitialSubscription(tx: TxLike, userId: string, now: Date) {
    const trialPlan = await this.getPlanByCode(tx, this.getDefaultPaidPlanCode());
    const period = this.createPeriod(now);
    const trialEndsAt = this.addDays(now, this.getTrialDays());

    return tx.userAiSubscription.create({
      data: {
        userId,
        subscriptionStatus: SubscriptionStatus.TRIAL,
        planId: trialPlan.id,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        tokensUsed: 0,
        tokensLimit: this.getTrialTokenLimit(),
        trialStartedAt: now,
        trialEndsAt,
        trialTokenLimit: this.getTrialTokenLimit(),
      },
    });
  }

  private resolveTokensLimit(
    subscriptionStatus: string,
    planTokenLimit: number,
    trialTokenLimit?: number | null,
  ) {
    if (subscriptionStatus === SubscriptionStatus.TRIAL) {
      return trialTokenLimit ?? this.getTrialTokenLimit();
    }
    return planTokenLimit;
  }

  private toUsageSummary(state: { subscription: any; effectivePlan: any }): AiUsageSummary {
    const { subscription, effectivePlan } = state;
    const tokensRemaining = Math.max(0, subscription.tokensLimit - subscription.tokensUsed);
    const availableFeatures = Array.from<string>(
      new Set((effectivePlan.features ?? []).map((feature: any) => String(feature.feature))),
    );

    return {
      subscriptionStatus: subscription.subscriptionStatus,
      currentPlan: {
        id: effectivePlan.id,
        name: effectivePlan.name,
        code: effectivePlan.code,
        monthlyTokenLimit: effectivePlan.monthlyTokenLimit,
        monthlyAiActions: effectivePlan.monthlyAiActions ?? null,
        priceCents: effectivePlan.priceCents,
        currency: effectivePlan.currency,
        isActive: effectivePlan.isActive,
      },
      currentPeriodStart: subscription.currentPeriodStart
        ? new Date(subscription.currentPeriodStart).toISOString()
        : null,
      currentPeriodEnd: subscription.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd).toISOString()
        : null,
      tokensUsed: subscription.tokensUsed,
      tokensLimit: subscription.tokensLimit,
      tokensRemaining,
      aiActionsUsed: this.tokensToUsedActions(
        subscription.tokensUsed,
        effectivePlan.monthlyTokenLimit,
        effectivePlan.monthlyAiActions,
      ),
      aiActionsRemaining: this.tokensToRemainingActions(
        tokensRemaining,
        effectivePlan.monthlyTokenLimit,
        effectivePlan.monthlyAiActions,
      ),
      availableFeatures,
      trialStartedAt: subscription.trialStartedAt
        ? new Date(subscription.trialStartedAt).toISOString()
        : null,
      trialEndsAt: subscription.trialEndsAt
        ? new Date(subscription.trialEndsAt).toISOString()
        : null,
    };
  }

  private tokensToUsedActions(
    tokensUsed: number,
    monthlyTokenLimit: number,
    monthlyAiActions?: number | null,
  ) {
    return Math.ceil(tokensUsed / this.resolveActionTokenUnit(monthlyTokenLimit, monthlyAiActions));
  }

  private tokensToRemainingActions(
    tokensRemaining: number,
    monthlyTokenLimit: number,
    monthlyAiActions?: number | null,
  ) {
    return Math.floor(tokensRemaining / this.resolveActionTokenUnit(monthlyTokenLimit, monthlyAiActions));
  }

  private resolveActionTokenUnit(monthlyTokenLimit: number, monthlyAiActions?: number | null) {
    if (monthlyAiActions && monthlyAiActions > 0) {
      return Math.max(1, Math.floor(monthlyTokenLimit / monthlyAiActions));
    }
    return this.getPlanActionTokenUnit();
  }

  private getPlanActionTokenUnit() {
    return Number(process.env.AI_ACTION_TOKEN_UNIT ?? DEFAULT_AI_ACTION_TOKEN_UNIT);
  }

  private getTrialTokenLimit() {
    return Number(process.env.AI_TRIAL_TOKEN_LIMIT ?? DEFAULT_TRIAL_TOKEN_LIMIT);
  }

  private getTrialDays() {
    return Number(process.env.AI_TRIAL_DAYS ?? DEFAULT_TRIAL_DAYS);
  }

  private getDefaultFreePlanCode() {
    return process.env.AI_DEFAULT_FREE_PLAN_CODE ?? DEFAULT_FREE_PLAN_CODE;
  }

  private getDefaultPaidPlanCode() {
    return process.env.AI_DEFAULT_PAID_PLAN_CODE ?? DEFAULT_PAID_PLAN_CODE;
  }

  private createPeriod(now: Date) {
    const start = new Date(now);
    const end = new Date(now);
    end.setUTCMonth(end.getUTCMonth() + 1);
    return { start, end };
  }

  private addDays(now: Date, days: number) {
    const value = new Date(now);
    value.setUTCDate(value.getUTCDate() + days);
    return value;
  }
}
