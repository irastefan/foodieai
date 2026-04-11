import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  AI_FEATURE_VALUES,
  SUBSCRIPTION_STATUS_VALUES,
  SubscriptionStatus,
} from "../ai-access.constants";

class AiPlanSummaryDto {
  @ApiProperty({ example: "plan_pro" })
  id!: string;

  @ApiProperty({ example: "Pro" })
  name!: string;

  @ApiProperty({ example: "pro" })
  code!: string;

  @ApiProperty({ example: 500000 })
  monthlyTokenLimit!: number;

  @ApiPropertyOptional({ example: 100, nullable: true })
  monthlyAiActions!: number | null;

  @ApiProperty({ example: 999 })
  priceCents!: number;

  @ApiProperty({ example: "USD" })
  currency!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class AiUsageResponseDto {
  @ApiProperty({ enum: SUBSCRIPTION_STATUS_VALUES, example: SubscriptionStatus.TRIAL })
  subscriptionStatus!: string;

  @ApiProperty({ type: AiPlanSummaryDto })
  currentPlan!: AiPlanSummaryDto;

  @ApiPropertyOptional({ example: "2026-04-10T12:00:00.000Z", nullable: true })
  currentPeriodStart!: string | null;

  @ApiPropertyOptional({ example: "2026-05-10T12:00:00.000Z", nullable: true })
  currentPeriodEnd!: string | null;

  @ApiProperty({ example: 25000 })
  tokensUsed!: number;

  @ApiProperty({ example: 100000 })
  tokensLimit!: number;

  @ApiProperty({ example: 75000 })
  tokensRemaining!: number;

  @ApiProperty({ example: 5 })
  aiActionsUsed!: number;

  @ApiProperty({ example: 15 })
  aiActionsRemaining!: number;

  @ApiProperty({ enum: AI_FEATURE_VALUES, isArray: true, example: ["RECIPE_GENERATION", "MEAL_ANALYSIS"] })
  availableFeatures!: string[];

  @ApiPropertyOptional({ example: "2026-04-10T12:00:00.000Z", nullable: true })
  trialStartedAt!: string | null;

  @ApiPropertyOptional({ example: "2026-04-24T12:00:00.000Z", nullable: true })
  trialEndsAt!: string | null;
}
