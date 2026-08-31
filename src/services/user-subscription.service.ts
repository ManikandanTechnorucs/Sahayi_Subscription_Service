import { config } from '../../libs/config/src/config';
import type { RazorpayClient } from '../clients/razorpay.client';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../errors/app-error';
import type { UserSubscriptionRepository } from '../repositories/user-subscription.repository';
import type {
  CancelUserSubscriptionInput,
  CreateCheckoutResponse,
  CreateUserSubscriptionInput,
  UserSubscription,
  UserSubscriptionStatus,
  VerifyUserSubscriptionInput,
} from '../types/user-subscription.types';

const TERMINAL_STATUSES: UserSubscriptionStatus[] = ['cancelled', 'completed', 'expired'];

/**
 * Business logic for user Razorpay subscriptions.
 */
export class UserSubscriptionService {
  readonly #userSubscriptionRepository: UserSubscriptionRepository;
  readonly #razorpayClient: RazorpayClient;

  constructor(
    userSubscriptionRepository: UserSubscriptionRepository,
    razorpayClient: RazorpayClient,
  ) {
    this.#userSubscriptionRepository = userSubscriptionRepository;
    this.#razorpayClient = razorpayClient;
  }

  async createSubscription(
    userId: string,
    input: CreateUserSubscriptionInput,
  ): Promise<CreateCheckoutResponse> {
    const existing = await this.#userSubscriptionRepository.findActiveByUserId(userId);

    if (existing) {
      throw new ConflictError('User already has an active subscription');
    }

    const plan = await this.#userSubscriptionRepository.findCatalogPlanById(input.planId);

    if (!plan) {
      throw new NotFoundError('Subscription plan');
    }

    const razorpayPlanId =
      input.billingCycle === 'monthly' ? plan.razorpayPlanIdMonthly : plan.razorpayPlanIdYearly;

    if (!razorpayPlanId) {
      throw new BadRequestError(
        `Razorpay plan is not configured for ${input.billingCycle} billing on this plan`,
      );
    }

    const totalCount = input.totalCount ?? config.RAZORPAY_DEFAULT_TOTAL_COUNT;

    const razorpaySubscription = await this.#razorpayClient.createSubscription({
      planId: razorpayPlanId,
      totalCount,
      quantity: 1,
      notes: {
        userId,
        localPlanId: String(plan.id),
        billingCycle: input.billingCycle,
      },
    });

    const created = await this.#userSubscriptionRepository.create({
      userId,
      planId: plan.id,
      billingCycle: input.billingCycle,
      status: 'created',
      razorpaySubscriptionId: razorpaySubscription.id,
      razorpayPlanId,
      totalCount: razorpaySubscription.totalCount || totalCount,
      quantity: razorpaySubscription.quantity || 1,
      paidCount: razorpaySubscription.paidCount,
      remainingCount: razorpaySubscription.remainingCount,
      razorpayCustomerId: razorpaySubscription.customerId,
      currentStart: this.#unixToDate(razorpaySubscription.currentStart),
      currentEnd: this.#unixToDate(razorpaySubscription.currentEnd),
      chargeAt: this.#unixToDate(razorpaySubscription.chargeAt),
      history: {
        eventSource: 'api_create',
        eventType: 'subscription.created',
        note: `Created ${input.billingCycle} subscription`,
      },
    });

    return {
      subscriptionId: created.id,
      razorpaySubscriptionId: created.razorpaySubscriptionId,
      razorpayKeyId: this.#razorpayClient.getKeyId(),
      status: created.status,
      plan: {
        id: plan.id,
        name: plan.name,
        label: plan.label,
        monthlyCost: plan.monthlyCost,
        yearlyCost: plan.yearlyCost,
        familyMembersLimit: plan.familyMembersLimit,
        emergencyContactsLimit: plan.emergencyContactsLimit,
        caregiverConnection: plan.caregiverConnection,
        caretakerConnection: plan.caretakerConnection,
        remindersLimit: plan.remindersLimit,
        emergencySOSalert: plan.emergencySOSalert,
        wearableIntegration: plan.wearableIntegration,
        advancedReminderTracking: plan.advancedReminderTracking,
        advancedHealthMonitor: plan.advancedHealthMonitor,
        advancedAINotification: plan.advancedAINotification,
        aiTextLimit: plan.aiTextLimit,
        aiVoiceLimit: plan.aiVoiceLimit,
        razorpayPlanIdMonthly: plan.razorpayPlanIdMonthly,
        razorpayPlanIdYearly: plan.razorpayPlanIdYearly,
      },
      checkout: {
        subscriptionId: created.razorpaySubscriptionId,
        name: config.CHECKOUT_DISPLAY_NAME,
        description: plan.label,
        prefill: {
          contact: null,
          email: null,
          name: null,
        },
      },
    };
  }

  async verifyCheckout(userId: string, input: VerifyUserSubscriptionInput): Promise<UserSubscription> {
    const subscription = await this.#userSubscriptionRepository.findByRazorpaySubscriptionId(
      input.razorpaySubscriptionId,
    );

    if (!subscription) {
      throw new NotFoundError('Subscription');
    }

    if (subscription.userId !== userId) {
      throw new ForbiddenError('Subscription does not belong to the authenticated user');
    }

    const valid = this.#razorpayClient.verifySubscriptionPayment({
      razorpayPaymentId: input.razorpayPaymentId,
      razorpaySubscriptionId: input.razorpaySubscriptionId,
      razorpaySignature: input.razorpaySignature,
    });

    if (!valid) {
      throw new BadRequestError('Invalid payment signature', 'INVALID_SIGNATURE');
    }

    await this.#userSubscriptionRepository.upsertPayment({
      userSubscriptionId: BigInt(subscription.id),
      razorpayPaymentId: input.razorpayPaymentId,
      status: 'authorized',
      paidAt: new Date(),
    });

    const nextStatus: UserSubscriptionStatus =
      subscription.status === 'created' ? 'authenticated' : subscription.status;

    const updated = await this.#userSubscriptionRepository.update(BigInt(subscription.id), {
      status: nextStatus,
      checkoutVerifiedAt: new Date(),
      history: {
        eventSource: 'api_verify',
        eventType: 'checkout.verified',
        note: `Payment ${input.razorpayPaymentId} verified`,
      },
    });

    if (!updated) {
      throw new NotFoundError('Subscription');
    }

    return updated;
  }

  async getCurrent(userId: string): Promise<UserSubscription | null> {
    return this.#userSubscriptionRepository.findActiveByUserId(userId);
  }

  async getById(userId: string, subscriptionId: string): Promise<UserSubscription> {
    const id = this.#parseId(subscriptionId);
    const subscription = await this.#userSubscriptionRepository.findByIdForUser(id, userId);

    if (!subscription) {
      throw new NotFoundError('Subscription');
    }

    return subscription;
  }

  async cancel(
    userId: string,
    subscriptionId: string,
    input: CancelUserSubscriptionInput,
  ): Promise<UserSubscription> {
    const subscription = await this.getById(userId, subscriptionId);
    this.#assertMutable(subscription);

    const cancelAtCycleEnd = input.cancelAtCycleEnd ?? false;
    const razorpayResult = await this.#razorpayClient.cancelSubscription(
      subscription.razorpaySubscriptionId,
      cancelAtCycleEnd,
    );

    const updated = await this.#userSubscriptionRepository.update(BigInt(subscription.id), {
      status: this.#mapRazorpayStatus(razorpayResult.status),
      cancelAtCycleEnd,
      cancelledAt: new Date(),
      endedAt: cancelAtCycleEnd ? null : new Date(),
      currentStart: this.#unixToDate(razorpayResult.currentStart),
      currentEnd: this.#unixToDate(razorpayResult.currentEnd),
      chargeAt: this.#unixToDate(razorpayResult.chargeAt),
      paidCount: razorpayResult.paidCount,
      remainingCount: razorpayResult.remainingCount,
      razorpayCustomerId: razorpayResult.customerId,
      history: {
        eventSource: 'api_cancel',
        eventType: 'subscription.cancelled',
        note: cancelAtCycleEnd ? 'Cancel at cycle end' : 'Cancel immediately',
      },
    });

    if (!updated) {
      throw new NotFoundError('Subscription');
    }

    return updated;
  }

  async pause(userId: string, subscriptionId: string): Promise<UserSubscription> {
    const subscription = await this.getById(userId, subscriptionId);
    this.#assertMutable(subscription);

    if (subscription.status !== 'active' && subscription.status !== 'authenticated') {
      throw new BadRequestError('Only active subscriptions can be paused');
    }

    const razorpayResult = await this.#razorpayClient.pauseSubscription(
      subscription.razorpaySubscriptionId,
    );

    const updated = await this.#userSubscriptionRepository.update(BigInt(subscription.id), {
      status: 'paused',
      pausedAt: new Date(),
      currentStart: this.#unixToDate(razorpayResult.currentStart),
      currentEnd: this.#unixToDate(razorpayResult.currentEnd),
      chargeAt: this.#unixToDate(razorpayResult.chargeAt),
      paidCount: razorpayResult.paidCount,
      remainingCount: razorpayResult.remainingCount,
      razorpayCustomerId: razorpayResult.customerId,
      history: {
        eventSource: 'api_pause',
        eventType: 'subscription.paused',
      },
    });

    if (!updated) {
      throw new NotFoundError('Subscription');
    }

    return updated;
  }

  async resume(userId: string, subscriptionId: string): Promise<UserSubscription> {
    const subscription = await this.getById(userId, subscriptionId);

    if (subscription.status !== 'paused') {
      throw new BadRequestError('Only paused subscriptions can be resumed');
    }

    const razorpayResult = await this.#razorpayClient.resumeSubscription(
      subscription.razorpaySubscriptionId,
    );

    const mapped = this.#mapRazorpayStatus(razorpayResult.status);
    const updated = await this.#userSubscriptionRepository.update(BigInt(subscription.id), {
      status: mapped === 'paused' ? 'active' : mapped,
      pausedAt: null,
      currentStart: this.#unixToDate(razorpayResult.currentStart),
      currentEnd: this.#unixToDate(razorpayResult.currentEnd),
      chargeAt: this.#unixToDate(razorpayResult.chargeAt),
      paidCount: razorpayResult.paidCount,
      remainingCount: razorpayResult.remainingCount,
      razorpayCustomerId: razorpayResult.customerId,
      history: {
        eventSource: 'api_resume',
        eventType: 'subscription.resumed',
      },
    });

    if (!updated) {
      throw new NotFoundError('Subscription');
    }

    return updated;
  }

  #assertMutable(subscription: UserSubscription): void {
    if (TERMINAL_STATUSES.includes(subscription.status)) {
      throw new BadRequestError(`Subscription is already ${subscription.status}`);
    }
  }

  #mapRazorpayStatus(status: string): UserSubscriptionStatus {
    const normalized = status.toLowerCase();
    const allowed: UserSubscriptionStatus[] = [
      'created',
      'authenticated',
      'active',
      'pending',
      'halted',
      'paused',
      'cancelled',
      'completed',
      'expired',
    ];

    if (allowed.includes(normalized as UserSubscriptionStatus)) {
      return normalized as UserSubscriptionStatus;
    }

    return 'pending';
  }

  #unixToDate(value: number | null): Date | null {
    if (value === null || value === undefined) {
      return null;
    }

    return new Date(value * 1000);
  }

  #parseId(id: string): bigint {
    if (!/^\d+$/.test(id)) {
      throw new BadRequestError('Invalid subscription id');
    }

    return BigInt(id);
  }
}
