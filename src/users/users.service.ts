import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ActivityLevel, GoalType, ProductScope, RecipeVisibility, Sex, TargetFormula } from "@prisma/client";
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
  targetFormula?: TargetFormula;
  calorieDelta?: number;
};

export type UpsertBodyMetricsInput = {
  date?: string;
  weightKg?: number;
  neckCm?: number;
  bustCm?: number;
  underbustCm?: number;
  waistCm?: number;
  hipsCm?: number;
  bicepsCm?: number;
  forearmCm?: number;
  thighCm?: number;
  calfCm?: number;
};

export type GetBodyMetricsHistoryInput = {
  fromDate?: string;
  toDate?: string;
  limitDays?: number;
};

type BodyMeasurements = {
  neckCm: number | null;
  bustCm: number | null;
  underbustCm: number | null;
  waistCm: number | null;
  hipsCm: number | null;
  bicepsCm: number | null;
  forearmCm: number | null;
  thighCm: number | null;
  calfCm: number | null;
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
    const user = await (this.prisma as any).user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) {
      return user;
    }
    return {
      ...user,
      profile: this.attachProfileMetadata(user.profile),
    };
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
        targetFormula: input.targetFormula ?? TargetFormula.MIFFLIN_ST_JEOR,
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
        targetFormula: input.targetFormula ?? undefined,
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

  async getProductsByUser(ownerUserId: string, viewerUserId?: string) {
    await this.ensureUserExists(ownerUserId);
    return this.prisma.product.findMany({
      where: {
        ownerUserId,
        ...(viewerUserId === ownerUserId
          ? {}
          : { scope: ProductScope.GLOBAL }),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async getRecipesByUser(ownerUserId: string, viewerUserId?: string) {
    await this.ensureUserExists(ownerUserId);
    return this.prisma.recipe.findMany({
      where: {
        ownerUserId,
        ...(viewerUserId === ownerUserId
          ? {}
          : { visibility: RecipeVisibility.PUBLIC }),
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        ingredients: { orderBy: { order: "asc" } },
        steps: { orderBy: { order: "asc" } },
      },
    });
  }

  async upsertBodyMetrics(userId: string, input: UpsertBodyMetricsInput) {
    const date = this.parseDay(input.date, "date");
    if (input.weightKg !== undefined && input.weightKg <= 0) {
      throw new BadRequestException("weightKg must be > 0");
    }

    const measurementsPatch = this.getBodyMeasurementsPatch(input);
    if (input.weightKg === undefined && !measurementsPatch) {
      throw new BadRequestException("Provide at least one metric field");
    }

    const existing = await (this.prisma as any).userBodyMetricEntry.findUnique({
      where: {
        userId_date: {
          userId,
          date,
        },
      },
    });

    const entry = await (this.prisma as any).userBodyMetricEntry.upsert({
      where: {
        userId_date: {
          userId,
          date,
        },
      },
      create: {
        userId,
        date,
        weightKg: input.weightKg ?? null,
        measurements: this.mergeBodyMeasurements(null, measurementsPatch),
      },
      update: {
        weightKg: input.weightKg ?? existing?.weightKg ?? null,
        measurements: this.mergeBodyMeasurements(existing?.measurements, measurementsPatch),
      },
    });

    return this.formatBodyMetricsEntry(entry);
  }

  async getBodyMetricsDay(userId: string, date?: string) {
    const targetDate = this.parseDay(date, "date");
    const entry = await (this.prisma as any).userBodyMetricEntry.findUnique({
      where: {
        userId_date: {
          userId,
          date: targetDate,
        },
      },
    });
    return entry ? this.formatBodyMetricsEntry(entry) : null;
  }

  async getBodyMetricsHistory(userId: string, input: GetBodyMetricsHistoryInput) {
    const range = this.resolveBodyMetricsHistoryRange(input);
    const entries = await (this.prisma as any).userBodyMetricEntry.findMany({
      where: {
        userId,
        date: {
          gte: range.from,
          lte: range.to,
        },
      },
      orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
    });

    return {
      fromDate: range.from.toISOString().slice(0, 10),
      toDate: range.to.toISOString().slice(0, 10),
      items: entries.map((entry: any) => this.formatBodyMetricsEntry(entry)),
    };
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
      targetFormula: TargetFormula | null;
      calorieDelta: number | null;
    },
    requireAll = false,
  ) {
    const missingFields = this.getMissingFields(profile);
    if (missingFields.length > 0) {
      if (requireAll) {
        throw new MissingFieldsError(missingFields);
      }
      return this.attachProfileMetadata(
        await (this.prisma as any).userProfile.findUnique({ where: { userId } }),
      );
    }

    const targets = this.tdeeService.calculateTargets({
      sex: profile.sex as Sex,
      birthDate: profile.birthDate as Date,
      heightCm: profile.heightCm as number,
      weightKg: profile.weightKg as number,
      activityLevel: profile.activityLevel as ActivityLevel,
      goal: profile.goal ?? GoalType.MAINTAIN,
      targetFormula: profile.targetFormula ?? TargetFormula.MIFFLIN_ST_JEOR,
      calorieDelta: profile.calorieDelta ?? undefined,
    });

    await (this.prisma as any).userProfile.update({
      where: { userId },
      data: {
        targetFormula: targets.targetFormula,
        targetCalories: targets.targetCalories,
        targetProteinG: targets.targetProteinG,
        targetFatG: targets.targetFatG,
        targetCarbsG: targets.targetCarbsG,
      },
    });

    return this.attachProfileMetadata(
      await (this.prisma as any).userProfile.findUnique({ where: { userId } }),
    );
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

  private parseDay(value?: string, fieldName = "date") {
    const normalized = value && value.trim().length > 0
      ? value
      : new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      throw new BadRequestException(`${fieldName} must be YYYY-MM-DD`);
    }
    const [year, month, day] = normalized.split("-").map((part) => Number(part));
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException(`${fieldName} is invalid`);
    }
    return date;
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
    if (date.getTime() > Date.now()) {
      throw new BadRequestException("birthDate cannot be in the future");
    }
    return date;
  }

  private getBodyMeasurementsPatch(input: UpsertBodyMetricsInput): Partial<BodyMeasurements> | null {
    const patch: Partial<BodyMeasurements> = {};
    const values = [
      ["neckCm", input.neckCm],
      ["bustCm", input.bustCm],
      ["underbustCm", input.underbustCm],
      ["waistCm", input.waistCm],
      ["hipsCm", input.hipsCm],
      ["bicepsCm", input.bicepsCm],
      ["forearmCm", input.forearmCm],
      ["thighCm", input.thighCm],
      ["calfCm", input.calfCm],
    ] as const;

    for (const [key, value] of values) {
      if (value === undefined) {
        continue;
      }
      if (value <= 0) {
        throw new BadRequestException(`${key} must be > 0`);
      }
      patch[key] = value;
    }

    return Object.keys(patch).length > 0 ? patch : null;
  }

  private mergeBodyMeasurements(
    existing: unknown,
    patch: Partial<BodyMeasurements> | null,
  ): BodyMeasurements | null {
    const base = this.parseBodyMeasurements(existing);
    const merged: BodyMeasurements = {
      neckCm: patch?.neckCm ?? base?.neckCm ?? null,
      bustCm: patch?.bustCm ?? base?.bustCm ?? null,
      underbustCm: patch?.underbustCm ?? base?.underbustCm ?? null,
      waistCm: patch?.waistCm ?? base?.waistCm ?? null,
      hipsCm: patch?.hipsCm ?? base?.hipsCm ?? null,
      bicepsCm: patch?.bicepsCm ?? base?.bicepsCm ?? null,
      forearmCm: patch?.forearmCm ?? base?.forearmCm ?? null,
      thighCm: patch?.thighCm ?? base?.thighCm ?? null,
      calfCm: patch?.calfCm ?? base?.calfCm ?? null,
    };
    return Object.values(merged).some((value) => value !== null) ? merged : null;
  }

  private parseBodyMeasurements(value: unknown): BodyMeasurements | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const source = value as Record<string, unknown>;
    const toNumberOrNull = (key: keyof BodyMeasurements) => {
      const raw = source[key];
      if (raw == null) {
        return null;
      }
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    };

    return {
      neckCm: toNumberOrNull("neckCm"),
      bustCm: toNumberOrNull("bustCm"),
      underbustCm: toNumberOrNull("underbustCm"),
      waistCm: toNumberOrNull("waistCm"),
      hipsCm: toNumberOrNull("hipsCm"),
      bicepsCm: toNumberOrNull("bicepsCm"),
      forearmCm: toNumberOrNull("forearmCm"),
      thighCm: toNumberOrNull("thighCm"),
      calfCm: toNumberOrNull("calfCm"),
    };
  }

  private formatBodyMetricsEntry(entry: any) {
    return {
      id: entry.id,
      userId: entry.userId,
      date: entry.date.toISOString().slice(0, 10),
      weightKg: entry.weightKg ?? null,
      measurements: this.parseBodyMeasurements(entry.measurements),
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    };
  }

  private resolveBodyMetricsHistoryRange(input: GetBodyMetricsHistoryInput) {
    const to = this.parseDay(input.toDate, "toDate");
    to.setUTCHours(23, 59, 59, 999);

    const from = input.fromDate
      ? this.parseDay(input.fromDate, "fromDate")
      : new Date(Date.UTC(
        to.getUTCFullYear(),
        to.getUTCMonth(),
        to.getUTCDate() - ((input.limitDays ?? 30) - 1),
      ));

    if (from > to) {
      throw new BadRequestException("fromDate must be <= toDate");
    }

    return { from, to };
  }

  private attachProfileMetadata<T extends { targetFormula?: TargetFormula | null } | null>(
    profile: T,
  ) {
    if (!profile) {
      return profile;
    }
    return {
      ...profile,
      targetFormula: profile.targetFormula ?? TargetFormula.MIFFLIN_ST_JEOR,
      availableTargetFormulas: this.tdeeService.getFormulaOptions(),
    };
  }

  private async ensureUserExists(userId: string) {
    const exists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        message: "User not found",
        userId,
      });
    }
  }
}
