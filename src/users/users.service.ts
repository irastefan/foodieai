import { BadRequestException, Injectable } from "@nestjs/common";
import { ActivityLevel, GoalType, Sex } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { TdeeService } from "../tdee/tdee.service";

export type UpsertProfileInput = {
  firstName?: string;
  lastName?: string;
  sex?: Sex;
  birthDate?: string;
  heightCm?: number;
  weightKg?: number;
  activityLevel?: ActivityLevel;
  goal?: GoalType;
  calorieDelta?: number;
};

export class MissingFieldsError extends BadRequestException {
  readonly missingFields: string[];

  constructor(missingFields: string[]) {
    super({
      code: "MISSING_FIELDS",
      message: "Missing required fields for target calculation",
      missingFields,
    });
    this.missingFields = missingFields;
  }
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tdeeService: TdeeService,
  ) {}

  async createWithEmail(email: string, passwordHash: string) {
    return (this.prisma as any).user.create({
      data: {
        email,
        passwordHash,
        externalId: email,
      },
      select: { id: true, email: true },
    });
  }

  async findByEmail(email: string) {
    return (this.prisma as any).user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true },
    });
  }

  async getById(userId: string) {
    return (this.prisma as any).user.findUnique({ where: { id: userId } });
  }

  async getUserWithProfile(userId: string) {
    return (this.prisma as any).user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
  }

  async upsertProfile(userId: string, input: UpsertProfileInput) {
    const parsedBirthDate = input.birthDate
      ? this.parseBirthDate(input.birthDate)
      : undefined;

    if (input.heightCm !== undefined && input.heightCm <= 0) {
      throw new BadRequestException("heightCm must be > 0");
    }
    if (input.weightKg !== undefined && input.weightKg <= 0) {
      throw new BadRequestException("weightKg must be > 0");
    }

    const profile = await (this.prisma as any).userProfile.upsert({
      where: { userId },
      create: {
        userId,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        sex: input.sex ?? null,
        birthDate: parsedBirthDate ?? null,
        heightCm: input.heightCm ?? null,
        weightKg: input.weightKg ?? null,
        activityLevel: input.activityLevel ?? null,
        goal: input.goal ?? null,
        calorieDelta: input.calorieDelta ?? null,
      },
      update: {
        firstName: input.firstName ?? undefined,
        lastName: input.lastName ?? undefined,
        sex: input.sex ?? undefined,
        birthDate: parsedBirthDate ?? undefined,
        heightCm: input.heightCm ?? undefined,
        weightKg: input.weightKg ?? undefined,
        activityLevel: input.activityLevel ?? undefined,
        goal: input.goal ?? undefined,
        calorieDelta: input.calorieDelta ?? undefined,
      },
    });

    return this.recalculateIfPossible(userId, profile);
  }

  async recalculateTargets(userId: string) {
    const profile = await (this.prisma as any).userProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new MissingFieldsError([
        "sex",
        "birthDate",
        "heightCm",
        "weightKg",
        "activityLevel",
      ]);
    }
    return this.recalculateIfPossible(userId, profile, true);
  }

  private async recalculateIfPossible(
    userId: string,
    profile: {
      sex: Sex | null;
      birthDate: Date | null;
      heightCm: number | null;
      weightKg: number | null;
      activityLevel: ActivityLevel | null;
      goal: GoalType | null;
      calorieDelta: number | null;
    },
    requireAll = false,
  ) {
    const missingFields = this.getMissingFields(profile);
    if (missingFields.length > 0) {
      if (requireAll) {
        throw new MissingFieldsError(missingFields);
      }
      return (this.prisma as any).userProfile.findUnique({ where: { userId } });
    }

    const targets = this.tdeeService.calculateTargets({
      sex: profile.sex as Sex,
      birthDate: profile.birthDate as Date,
      heightCm: profile.heightCm as number,
      weightKg: profile.weightKg as number,
      activityLevel: profile.activityLevel as ActivityLevel,
      goal: profile.goal ?? GoalType.MAINTAIN,
      calorieDelta: profile.calorieDelta ?? undefined,
    });

    await (this.prisma as any).userProfile.update({
      where: { userId },
      data: {
        targetCalories: targets.targetCalories,
        targetProteinG: targets.targetProteinG,
        targetFatG: targets.targetFatG,
        targetCarbsG: targets.targetCarbsG,
      },
    });

    return (this.prisma as any).userProfile.findUnique({ where: { userId } });
  }

  private getMissingFields(profile: {
    sex: Sex | null;
    birthDate: Date | null;
    heightCm: number | null;
    weightKg: number | null;
    activityLevel: ActivityLevel | null;
  }) {
    const missing: string[] = [];
    if (!profile.sex) missing.push("sex");
    if (!profile.birthDate) missing.push("birthDate");
    if (!profile.heightCm) missing.push("heightCm");
    if (!profile.weightKg) missing.push("weightKg");
    if (!profile.activityLevel) missing.push("activityLevel");
    return missing;
  }

  private parseBirthDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException("birthDate must be YYYY-MM-DD");
    }
    const [year, month, day] = value.split("-").map((part) => Number(part));
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException("birthDate is invalid");
    }
    return date;
  }
}
