import type {
  BillingCycle,
  Prisma,
  PrismaClient,
  UserSubscriptionStatus,
} from '../../generated/prisma/client';
import type {
  UserSubscription,
} from '../types/user-subscription.types';
import type { SubscriptionPlan } from '../types/subscription.types';

const planSelect = {
  Id: true,
  Name: true,
  Label: true,
  MonthlyCost: true,
  yearlyCost: true,
  FamilyMembersLimit: true,
  EmergencyContactsLimit: true,
  CaregiverConnection: true,
  CaretakerConnection: true,
  RemindersLimit: true,
  EmergencySOSalert: true,
  WearableIntegration: true,
  AdvancedReminderTracking: true,
  AdvancedHealthMonitor: true,
  AdvancedAINotification: true,
  AITextLimit: true,
  AIVoiceLimit: true,
  RazorpayPlanIdMonthly: true,
  RazorpayPlanIdYearly: true,
} as const;

type PlanRow = {
  Id: number;
  Name: string;
  Label: string;
  MonthlyCost: string;
  yearlyCost: string;
  FamilyMembersLimit: number;
  EmergencyContactsLimit: number;
  CaregiverConnection: number;
  CaretakerConnection: number;
  RemindersLimit: string;
  EmergencySOSalert: boolean;
  WearableIntegration: boolean;
  AdvancedReminderTracking: boolean;
  AdvancedHealthMonitor: boolean;
  AdvancedAINotification: boolean;
  AITextLimit: string | null;
  AIVoiceLimit: string | null;
  RazorpayPlanIdMonthly: string | null;
  RazorpayPlanIdYearly: string | null;
};

type UserSubscriptionRow = {
  Id: bigint;
  UserId: string;
  PlanId: number;
  BillingCycle: BillingCycle;
  Status: UserSubscriptionStatus;
  RazorpaySubscriptionId: string;
  RazorpayCustomerId: string | null;
  RazorpayPlanId: string;
  TotalCount: number;
  PaidCount: number;
  RemainingCount: number | null;
  Quantity: number;
  CurrentStart: Date | null;
  CurrentEnd: Date | null;
  ChargeAt: Date | null;
  CheckoutVerifiedAt: Date | null;
  CancelledAt: Date | null;
  CancelAtCycleEnd: boolean;
  PausedAt: Date | null;
  EndedAt: Date | null;
  CreatedAt: Date;
  UpdatedAt: Date | null;
  plan?: PlanRow;
};

export type CatalogPlanWithRazorpay = SubscriptionPlan & {
  razorpayPlanIdMonthly: string | null;
  razorpayPlanIdYearly: string | null;
};

export type CreateUserSubscriptionRecordInput = {
  userId: string;
  planId: number;
  billingCycle: BillingCycle;
  status: UserSubscriptionStatus;
  razorpaySubscriptionId: string;
  razorpayPlanId: string;
  totalCount: number;
  quantity: number;
  paidCount?: number;
  remainingCount?: number | null;
  razorpayCustomerId?: string | null;
  currentStart?: Date | null;
  currentEnd?: Date | null;
  chargeAt?: Date | null;
  history?: {
    eventSource: string;
    eventType?: string | null;
    note?: string | null;
  };
};

export type UpdateUserSubscriptionRecordInput = {
  status?: UserSubscriptionStatus;
  razorpayCustomerId?: string | null;
  paidCount?: number;
  remainingCount?: number | null;
  currentStart?: Date | null;
  currentEnd?: Date | null;
  chargeAt?: Date | null;
  checkoutVerifiedAt?: Date | null;
  cancelledAt?: Date | null;
  cancelAtCycleEnd?: boolean;
  pausedAt?: Date | null;
  endedAt?: Date | null;
  history?: {
    eventSource: string;
    eventType?: string | null;
    note?: string | null;
  };
};

const ACTIVE_STATUSES: UserSubscriptionStatus[] = [
  'created',
  'authenticated',
  'active',
  'pending',
  'halted',
  'paused',
];

/**
 * Repository for user subscription persistence.
 */
export class UserSubscriptionRepository {
  readonly #prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.#prisma = prisma;
  }

  async findCatalogPlanById(planId: number): Promise<CatalogPlanWithRazorpay | null> {
    const row = await this.#prisma.subscriptionmaster.findFirst({
      where: { Id: planId, IsActive: true },
      select: planSelect,
    });

    return row ? this.#mapCatalogPlan(row) : null;
  }

  async findActiveByUserId(userId: string): Promise<UserSubscription | null> {
    const row = await this.#prisma.userSubscription.findFirst({
      where: {
        UserId: userId,
        Status: { in: ACTIVE_STATUSES },
      },
      orderBy: { CreatedAt: 'desc' },
      include: { plan: { select: planSelect } },
    });

    return row ? this.#mapUserSubscription(row) : null;
  }

  async findByIdForUser(id: bigint, userId: string): Promise<UserSubscription | null> {
    const row = await this.#prisma.userSubscription.findFirst({
      where: { Id: id, UserId: userId },
      include: { plan: { select: planSelect } },
    });

    return row ? this.#mapUserSubscription(row) : null;
  }

  async findByRazorpaySubscriptionId(
    razorpaySubscriptionId: string,
  ): Promise<UserSubscription | null> {
    const row = await this.#prisma.userSubscription.findUnique({
      where: { RazorpaySubscriptionId: razorpaySubscriptionId },
      include: { plan: { select: planSelect } },
    });

    return row ? this.#mapUserSubscription(row) : null;
  }

  async create(input: CreateUserSubscriptionRecordInput): Promise<UserSubscription> {
    const row = await this.#prisma.$transaction(async (tx) => {
      const created = await tx.userSubscription.create({
        data: {
          UserId: input.userId,
          PlanId: input.planId,
          BillingCycle: input.billingCycle,
          Status: input.status,
          RazorpaySubscriptionId: input.razorpaySubscriptionId,
          RazorpayPlanId: input.razorpayPlanId,
          RazorpayCustomerId: input.razorpayCustomerId ?? null,
          TotalCount: input.totalCount,
          Quantity: input.quantity,
          PaidCount: input.paidCount ?? 0,
          RemainingCount: input.remainingCount ?? null,
          CurrentStart: input.currentStart ?? null,
          CurrentEnd: input.currentEnd ?? null,
          ChargeAt: input.chargeAt ?? null,
        },
        include: { plan: { select: planSelect } },
      });

      await tx.userSubscriptionHistory.create({
        data: {
          UserId: created.UserId,
          UserSubscriptionId: created.Id,
          PlanId: created.PlanId,
          BillingCycle: created.BillingCycle,
          FromStatus: null,
          ToStatus: created.Status,
          EventSource: input.history?.eventSource ?? 'api_create',
          EventType: input.history?.eventType ?? null,
          RazorpaySubscriptionId: created.RazorpaySubscriptionId,
          Note: input.history?.note ?? null,
        },
      });

      return created;
    });

    return this.#mapUserSubscription(row);
  }

  async update(
    id: bigint,
    input: UpdateUserSubscriptionRecordInput,
  ): Promise<UserSubscription | null> {
    const existing = await this.#prisma.userSubscription.findUnique({
      where: { Id: id },
    });

    if (!existing) {
      return null;
    }

    const data: Prisma.UserSubscriptionUpdateInput = {
      UpdatedAt: new Date(),
    };

    if (input.status !== undefined) {
      data.Status = input.status;
    }

    if (input.razorpayCustomerId !== undefined) {
      data.RazorpayCustomerId = input.razorpayCustomerId;
    }

    if (input.paidCount !== undefined) {
      data.PaidCount = input.paidCount;
    }

    if (input.remainingCount !== undefined) {
      data.RemainingCount = input.remainingCount;
    }

    if (input.currentStart !== undefined) {
      data.CurrentStart = input.currentStart;
    }

    if (input.currentEnd !== undefined) {
      data.CurrentEnd = input.currentEnd;
    }

    if (input.chargeAt !== undefined) {
      data.ChargeAt = input.chargeAt;
    }

    if (input.checkoutVerifiedAt !== undefined) {
      data.CheckoutVerifiedAt = input.checkoutVerifiedAt;
    }

    if (input.cancelledAt !== undefined) {
      data.CancelledAt = input.cancelledAt;
    }

    if (input.cancelAtCycleEnd !== undefined) {
      data.CancelAtCycleEnd = input.cancelAtCycleEnd;
    }

    if (input.pausedAt !== undefined) {
      data.PausedAt = input.pausedAt;
    }

    if (input.endedAt !== undefined) {
      data.EndedAt = input.endedAt;
    }

    const statusChanged =
      input.status !== undefined && input.status !== existing.Status;

    const row = await this.#prisma.$transaction(async (tx) => {
      const updated = await tx.userSubscription.update({
        where: { Id: id },
        data,
        include: { plan: { select: planSelect } },
      });

      if (statusChanged || input.history) {
        await tx.userSubscriptionHistory.create({
          data: {
            UserId: updated.UserId,
            UserSubscriptionId: updated.Id,
            PlanId: updated.PlanId,
            BillingCycle: updated.BillingCycle,
            FromStatus: existing.Status,
            ToStatus: updated.Status,
            EventSource: input.history?.eventSource ?? 'api_update',
            EventType: input.history?.eventType ?? null,
            RazorpaySubscriptionId: updated.RazorpaySubscriptionId,
            Note: input.history?.note ?? null,
          },
        });
      }

      return updated;
    });

    return this.#mapUserSubscription(row);
  }

  async upsertPayment(input: {
    userSubscriptionId: bigint;
    razorpayPaymentId: string;
    amount?: number | null;
    currency?: string | null;
    status: string;
    paidAt?: Date | null;
  }): Promise<void> {
    await this.#prisma.subscriptionPayment.upsert({
      where: { RazorpayPaymentId: input.razorpayPaymentId },
      create: {
        UserSubscriptionId: input.userSubscriptionId,
        RazorpayPaymentId: input.razorpayPaymentId,
        Amount: input.amount ?? null,
        Currency: input.currency ?? null,
        Status: input.status,
        PaidAt: input.paidAt ?? null,
      },
      update: {
        Amount: input.amount ?? null,
        Currency: input.currency ?? null,
        Status: input.status,
        PaidAt: input.paidAt ?? null,
        UpdatedAt: new Date(),
      },
    });
  }

  #mapCatalogPlan(row: PlanRow): CatalogPlanWithRazorpay {
    return {
      id: row.Id,
      name: row.Name,
      label: row.Label,
      monthlyCost: row.MonthlyCost,
      yearlyCost: row.yearlyCost,
      familyMembersLimit: row.FamilyMembersLimit,
      emergencyContactsLimit: row.EmergencyContactsLimit,
      caregiverConnection: row.CaregiverConnection,
      caretakerConnection: row.CaretakerConnection,
      remindersLimit: row.RemindersLimit,
      emergencySOSalert: row.EmergencySOSalert,
      wearableIntegration: row.WearableIntegration,
      advancedReminderTracking: row.AdvancedReminderTracking,
      advancedHealthMonitor: row.AdvancedHealthMonitor,
      advancedAINotification: row.AdvancedAINotification,
      aiTextLimit: row.AITextLimit,
      aiVoiceLimit: row.AIVoiceLimit,
      razorpayPlanIdMonthly: row.RazorpayPlanIdMonthly,
      razorpayPlanIdYearly: row.RazorpayPlanIdYearly,
    };
  }

  #mapUserSubscription(row: UserSubscriptionRow): UserSubscription {
    const mapped: UserSubscription = {
      id: row.Id.toString(),
      userId: row.UserId,
      planId: row.PlanId,
      billingCycle: row.BillingCycle,
      status: row.Status,
      razorpaySubscriptionId: row.RazorpaySubscriptionId,
      razorpayCustomerId: row.RazorpayCustomerId,
      razorpayPlanId: row.RazorpayPlanId,
      totalCount: row.TotalCount,
      paidCount: row.PaidCount,
      remainingCount: row.RemainingCount,
      quantity: row.Quantity,
      currentStart: row.CurrentStart,
      currentEnd: row.CurrentEnd,
      chargeAt: row.ChargeAt,
      checkoutVerifiedAt: row.CheckoutVerifiedAt,
      cancelledAt: row.CancelledAt,
      cancelAtCycleEnd: row.CancelAtCycleEnd,
      pausedAt: row.PausedAt,
      endedAt: row.EndedAt,
      createdAt: row.CreatedAt,
      updatedAt: row.UpdatedAt,
    };

    if (row.plan) {
      mapped.plan = this.#mapCatalogPlan(row.plan);
    }

    return mapped;
  }
}
