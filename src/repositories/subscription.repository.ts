import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import type {
  CreateSubscriptionInput,
  SubscriptionPlan,
  UpdateSubscriptionInput,
} from '../types/subscription.types';

const subscriptionSelect = {
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

type SubscriptionRow = {
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

/**
 * Repository responsible for subscription plan persistence.
 */
export class SubscriptionRepository {
  readonly #prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.#prisma = prisma;
  }

  /**
   * Returns active subscription master records.
   */
  async findActiveSubscriptions(): Promise<SubscriptionPlan[]> {
    const rows = await this.#prisma.subscriptionmaster.findMany({
      where: { IsActive: true },
      orderBy: { Label: 'asc' },
      select: subscriptionSelect,
    });

    return rows.map((row) => this.#mapSubscription(row));
  }

  /**
   * Returns a subscription plan by id, or null if missing.
   */
  async findById(id: number): Promise<SubscriptionPlan | null> {
    const row = await this.#prisma.subscriptionmaster.findUnique({
      where: { Id: id },
      select: subscriptionSelect,
    });

    return row ? this.#mapSubscription(row) : null;
  }

  /**
   * Creates a subscription plan.
   */
  async create(input: CreateSubscriptionInput): Promise<SubscriptionPlan> {
    const data: Prisma.subscriptionmasterUncheckedCreateInput = {
      Name: input.name,
      Label: input.label,
      MonthlyCost: input.monthlyCost,
      yearlyCost: input.yearlyCost,
      FamilyMembersLimit: input.familyMembersLimit,
      EmergencyContactsLimit: input.emergencyContactsLimit,
      CaregiverConnection: input.caregiverConnection,
      CaretakerConnection: input.caretakerConnection,
      RemindersLimit: input.remindersLimit,
      EmergencySOSalert: input.emergencySOSalert,
      WearableIntegration: input.wearableIntegration,
      AdvancedReminderTracking: input.advancedReminderTracking,
      AdvancedHealthMonitor: input.advancedHealthMonitor,
      AdvancedAINotification: input.advancedAINotification,
      IsActive: input.isActive ?? true,
    };

    if (input.aiTextLimit !== undefined) {
      data.AITextLimit = input.aiTextLimit;
    }

    if (input.aiVoiceLimit !== undefined) {
      data.AIVoiceLimit = input.aiVoiceLimit;
    }

    if (input.razorpayPlanIdMonthly !== undefined) {
      data.RazorpayPlanIdMonthly = input.razorpayPlanIdMonthly;
    }

    if (input.razorpayPlanIdYearly !== undefined) {
      data.RazorpayPlanIdYearly = input.razorpayPlanIdYearly;
    }

    const row = await this.#prisma.subscriptionmaster.create({
      data,
      select: subscriptionSelect,
    });

    return this.#mapSubscription(row);
  }

  /**
   * Updates a subscription plan by id, or returns null if missing.
   */
  async update(id: number, input: UpdateSubscriptionInput): Promise<SubscriptionPlan | null> {
    const existing = await this.#prisma.subscriptionmaster.findUnique({
      where: { Id: id },
      select: { Id: true },
    });

    if (!existing) {
      return null;
    }

    const data: Prisma.subscriptionmasterUpdateInput = {
      UpdatedAt: new Date(),
    };

    if (input.name !== undefined) {
      data.Name = input.name;
    }

    if (input.label !== undefined) {
      data.Label = input.label;
    }

    if (input.monthlyCost !== undefined) {
      data.MonthlyCost = input.monthlyCost;
    }

    if (input.yearlyCost !== undefined) {
      data.yearlyCost = input.yearlyCost;
    }

    if (input.familyMembersLimit !== undefined) {
      data.FamilyMembersLimit = input.familyMembersLimit;
    }

    if (input.emergencyContactsLimit !== undefined) {
      data.EmergencyContactsLimit = input.emergencyContactsLimit;
    }

    if (input.caregiverConnection !== undefined) {
      data.CaregiverConnection = input.caregiverConnection;
    }

    if (input.caretakerConnection !== undefined) {
      data.CaretakerConnection = input.caretakerConnection;
    }

    if (input.remindersLimit !== undefined) {
      data.RemindersLimit = input.remindersLimit;
    }

    if (input.emergencySOSalert !== undefined) {
      data.EmergencySOSalert = input.emergencySOSalert;
    }

    if (input.wearableIntegration !== undefined) {
      data.WearableIntegration = input.wearableIntegration;
    }

    if (input.advancedReminderTracking !== undefined) {
      data.AdvancedReminderTracking = input.advancedReminderTracking;
    }

    if (input.advancedHealthMonitor !== undefined) {
      data.AdvancedHealthMonitor = input.advancedHealthMonitor;
    }

    if (input.advancedAINotification !== undefined) {
      data.AdvancedAINotification = input.advancedAINotification;
    }

    if (input.aiTextLimit !== undefined) {
      data.AITextLimit = input.aiTextLimit;
    }

    if (input.aiVoiceLimit !== undefined) {
      data.AIVoiceLimit = input.aiVoiceLimit;
    }

    if (input.razorpayPlanIdMonthly !== undefined) {
      data.RazorpayPlanIdMonthly = input.razorpayPlanIdMonthly;
    }

    if (input.razorpayPlanIdYearly !== undefined) {
      data.RazorpayPlanIdYearly = input.razorpayPlanIdYearly;
    }

    if (input.isActive !== undefined) {
      data.IsActive = input.isActive;
    }

    const row = await this.#prisma.subscriptionmaster.update({
      where: { Id: id },
      data,
      select: subscriptionSelect,
    });

    return this.#mapSubscription(row);
  }

  #mapSubscription(row: SubscriptionRow): SubscriptionPlan {
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
}
