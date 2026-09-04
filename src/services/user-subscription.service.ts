import { config } from '../../libs/config/src/config';
import { logger } from '../../libs/logger/src/logger';
import type { RazorpayClient } from '../clients/razorpay.client';
import type { UserEntitlementClient } from '../clients/user-entitlement.client';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../errors/app-error';
import type { UserSubscriptionRepository, CatalogPlanWithRazorpay } from '../repositories/user-subscription.repository';
import type {
  CancelUserSubscriptionInput,
  CreateCheckoutResponse,
  CreateUserSubscriptionInput,
  UserSubscription,
  UserSubscriptionStatus,
  VerifyUserSubscriptionInput,
} from '../types/user-subscription.types';

const TERMINAL_STATUSES: UserSubscriptionStatus[] = ['cancelled', 'completed', 'expired'];
const ENTITLEMENT_STATUSES: UserSubscriptionStatus[] = ['authenticated', 'active'];

/**
 * Business logic for user Razorpay subscriptions.
 */
export class UserSubscriptionService {
  readonly #userSubscriptionRepository: UserSubscriptionRepository;
  readonly #razorpayClient: RazorpayClient;
  readonly #userEntitlementClient: UserEntitlementClient;

  constructor(
    userSubscriptionRepository: UserSubscriptionRepository,
    razorpayClient: RazorpayClient,
    userEntitlementClient: UserEntitlementClient,
  ) {
    this.#userSubscriptionRepository = userSubscriptionRepository;
    this.#razorpayClient = razorpayClient;
    this.#userEntitlementClient = userEntitlementClient;
  }

  async createSubscription(
    userId: string,
    input: CreateUserSubscriptionInput,
  ): Promise<CreateCheckoutResponse> {
    const plan = await this.#userSubscriptionRepository.findCatalogPlanById(input.planId);

    if (!plan) {
      throw new NotFoundError('Subscription plan');
    }

    const inFlight = await this.#userSubscriptionRepository.findCreatedByUserId(userId);
    const billing = await this.#userSubscriptionRepository.findActiveByUserId(userId);

    if (!this.#isPaidCycle(plan, input.billingCycle)) {
      if (inFlight) {
        await this.#cancelQuietly(inFlight, 'Abandoned checkout cancelled for free plan change');
      }

      if (billing) {
        await this.#cancelQuietly(billing, 'Paid subscription cancelled for free plan change');
      }

      await this.#userEntitlementClient.setSubscriptionId(userId, plan.id);

      return {
        subscriptionId: null,
        razorpaySubscriptionId: null,
        razorpayKeyId: null,
        checkoutRequired: false,
        status: 'none',
        plan,
        checkout: null,
      };
    }

    if (
      inFlight &&
      inFlight.planId === input.planId &&
      inFlight.billingCycle === input.billingCycle
    ) {
      return this.#toCheckoutResponse(inFlight, plan);
    }

    if (inFlight) {
      await this.#cancelQuietly(inFlight, 'Abandoned checkout cancelled before creating a new plan');
    }

    if (
      billing &&
      billing.planId === input.planId &&
      billing.billingCycle === input.billingCycle
    ) {
      throw new ConflictError('User already has this subscription');
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
        note: billing
          ? `Created ${input.billingCycle} subscription to replace plan ${billing.planId}`
          : `Created ${input.billingCycle} subscription`,
      },
    });

    return this.#toCheckoutResponse(created, plan);
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

    await this.activateEntitlements(updated);

    return updated;
  }

  /**
   * Cancels other live subscriptions and writes users.SubscriptionId after payment/auth.
   * Also records the plan the user currently has in usersubscriptionhistory.
   */
  async activateEntitlements(subscription: UserSubscription): Promise<void> {
    if (!ENTITLEMENT_STATUSES.includes(subscription.status)) {
      return;
    }

    try {
      await this.#recordCurrentAtPayment(subscription);
    } catch (error) {
      logger.warn(
        {
          service: 'subscription-service',
          userId: subscription.userId,
          paidSubscriptionId: subscription.id,
          err: error instanceof Error ? error.message : 'history write failed',
        },
        'current plan history write failed',
      );
    }

    await this.#supersedeOthers(subscription.userId, subscription.id);
    await this.#userEntitlementClient.setSubscriptionId(subscription.userId, subscription.planId);
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

  async #supersedeOthers(userId: string, keepId: string): Promise<void> {
    const others = await this.#userSubscriptionRepository.findNonTerminalByUserId(userId);

    for (const other of others) {
      if (other.id === keepId) {
        continue;
      }

      await this.#cancelQuietly(other, `Superseded by subscription ${keepId}`);
    }
  }

  /**
   * Writes the plan the user already has before this payment takes effect.
   */
  async #recordCurrentAtPayment(paid: UserSubscription): Promise<void> {
    const currentBilling = await this.#userSubscriptionRepository.findActiveByUserIdExcluding(
      paid.userId,
      BigInt(paid.id),
    );

    if (currentBilling) {
      await this.#userSubscriptionRepository.createHistory({
        userId: currentBilling.userId,
        userSubscriptionId: BigInt(currentBilling.id),
        planId: currentBilling.planId,
        billingCycle: currentBilling.billingCycle,
        fromStatus: currentBilling.status,
        toStatus: currentBilling.status,
        eventSource: 'api_pay',
        eventType: 'subscription.current',
        razorpaySubscriptionId: currentBilling.razorpaySubscriptionId,
        note: `Current subscription at payment for ${paid.id}`,
      });
      return;
    }

    let currentPlanId: number | null;

    try {
      currentPlanId = await this.#userEntitlementClient.getSubscriptionId(paid.userId);
    } catch (error) {
      logger.warn(
        {
          service: 'subscription-service',
          userId: paid.userId,
          paidSubscriptionId: paid.id,
          err: error instanceof Error ? error.message : 'entitlement lookup failed',
        },
        'could not load current plan for payment history',
      );
      return;
    }

    if (currentPlanId === null || currentPlanId === paid.planId) {
      return;
    }

    await this.#userSubscriptionRepository.createHistory({
      userId: paid.userId,
      planId: currentPlanId,
      eventSource: 'api_pay',
      eventType: 'subscription.current',
      note: `Current plan ${currentPlanId} at payment for ${paid.id}`,
    });
  }

  async #cancelQuietly(subscription: UserSubscription, note: string): Promise<void> {
    if (TERMINAL_STATUSES.includes(subscription.status)) {
      return;
    }

    try {
      await this.#razorpayClient.cancelSubscription(subscription.razorpaySubscriptionId, false);
    } catch (error) {
      logger.warn(
        {
          service: 'subscription-service',
          userId: subscription.userId,
          razorpaySubscriptionId: subscription.razorpaySubscriptionId,
          err: error instanceof Error ? error.message : 'cancel failed',
        },
        'razorpay cancel during plan change failed',
      );
    }

    await this.#userSubscriptionRepository.update(BigInt(subscription.id), {
      status: 'cancelled',
      cancelledAt: new Date(),
      endedAt: new Date(),
      history: {
        eventSource: 'api_supersede',
        eventType: 'subscription.cancelled',
        note,
      },
    });
  }

  #toCheckoutResponse(
    subscription: UserSubscription,
    plan: CatalogPlanWithRazorpay,
  ): CreateCheckoutResponse {
    return {
      subscriptionId: subscription.id,
      razorpaySubscriptionId: subscription.razorpaySubscriptionId,
      razorpayKeyId: this.#razorpayClient.getKeyId(),
      checkoutRequired: true,
      status: subscription.status,
      plan,
      checkout: {
        subscriptionId: subscription.razorpaySubscriptionId,
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

  #isPaidCycle(plan: CatalogPlanWithRazorpay, billingCycle: 'monthly' | 'yearly'): boolean {
    const cost = billingCycle === 'monthly' ? plan.monthlyCost : plan.yearlyCost;
    const amount = Number(cost);
    return Number.isFinite(amount) && amount > 0;
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
