import { config } from '../../libs/config/src/config';
import { logger } from '../../libs/logger/src/logger';
import type { RazorpayClient } from '../clients/razorpay.client';
import type { UserEntitlementClient } from '../clients/user-entitlement.client';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../errors/app-error';
import type { UserSubscriptionRepository, CatalogPlanWithRazorpay } from '../repositories/user-subscription.repository';
import {
  isPaidCatalogCycle,
  resolveScheduledStartAt,
  resolveSubscriptionActivation,
} from './subscription-change.policy';
import type {
  CancelUserSubscriptionInput,
  CreateCheckoutResponse,
  CreateUserSubscriptionInput,
  CurrentUserSubscription,
  ScheduledSubscriptionChange,
  SubscriptionActivation,
  UserSubscription,
  UserSubscriptionStatus,
  VerifyUserSubscriptionInput,
} from '../types/user-subscription.types';

const TERMINAL_STATUSES: UserSubscriptionStatus[] = ['cancelled', 'completed', 'expired'];
const ENTITLEMENT_STATUSES: UserSubscriptionStatus[] = ['authenticated', 'active'];
const LIVE_BILLING_STATUSES: UserSubscriptionStatus[] = [
  'authenticated',
  'active',
  'pending',
  'halted',
  'paused',
];
const WAITING_SCHEDULED_STATUSES: UserSubscriptionStatus[] = ['created', 'authenticated'];

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
    const scheduled = await this.#userSubscriptionRepository.findScheduledByUserId(userId);
    const isPaid = isPaidCatalogCycle(plan, input.billingCycle);
    const activation = this.#resolveActivation(billing, plan, input.billingCycle, isPaid);

    if (!isPaid) {
      return this.#assignFreePlan(userId, plan, input.billingCycle, {
        inFlight,
        billing,
        scheduled,
        activation,
      });
    }

    if (
      inFlight &&
      inFlight.planId === input.planId &&
      inFlight.billingCycle === input.billingCycle
    ) {
      return this.#toCheckoutResponse(
        inFlight,
        plan,
        inFlight.replacesUserSubscriptionId ? 'period_end' : 'immediate',
      );
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

    if (scheduled && activation === 'period_end') {
      throw new ConflictError('A plan change is already scheduled for the end of the current period');
    }

    const razorpayPlanId =
      input.billingCycle === 'monthly' ? plan.razorpayPlanIdMonthly : plan.razorpayPlanIdYearly;

    if (!razorpayPlanId) {
      throw new BadRequestError(
        `Razorpay plan is not configured for ${input.billingCycle} billing on this plan`,
      );
    }

    const totalCount = input.totalCount ?? config.RAZORPAY_DEFAULT_TOTAL_COUNT;
    const scheduledStartAt =
      activation === 'period_end' && billing?.currentEnd
        ? resolveScheduledStartAt(
            billing.currentEnd,
            new Date(),
            config.RAZORPAY_MIN_START_AT_OFFSET_SEC,
          )
        : null;

    const razorpaySubscription = await this.#razorpayClient.createSubscription({
      planId: razorpayPlanId,
      totalCount,
      quantity: 1,
      startAt: scheduledStartAt ? this.#dateToUnix(scheduledStartAt) : null,
      notes: {
        userId,
        localPlanId: String(plan.id),
        billingCycle: input.billingCycle,
        activation,
        ...(billing ? { replacesUserSubscriptionId: billing.id } : {}),
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
      replacesUserSubscriptionId:
        activation === 'period_end' && billing ? BigInt(billing.id) : null,
      scheduledStartAt,
      history: {
        eventSource: 'api_create',
        eventType: 'subscription.created',
        note: billing
          ? activation === 'period_end'
            ? `Scheduled ${input.billingCycle} subscription to replace plan ${billing.planId} at period end`
            : `Created ${input.billingCycle} subscription to replace plan ${billing.planId}`
          : `Created ${input.billingCycle} subscription`,
      },
    });

    return this.#toCheckoutResponse(created, plan, activation);
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

    const previousStatus = subscription.status;
    const nextStatus: UserSubscriptionStatus =
      previousStatus === 'created' ? 'authenticated' : previousStatus;

    const updated = await this.#userSubscriptionRepository.update(BigInt(subscription.id), {
      status: nextStatus,
      checkoutVerifiedAt: new Date(),
      ...(nextStatus !== previousStatus
        ? {
            history: {
              eventSource: 'api_verify',
              eventType: 'checkout.verified',
              note: subscription.replacesUserSubscriptionId
                ? `Payment ${input.razorpayPaymentId} verified; plan change scheduled at period end`
                : `Payment ${input.razorpayPaymentId} verified`,
            },
          }
        : {}),
    });

    if (!updated) {
      throw new NotFoundError('Subscription');
    }

    if (updated.replacesUserSubscriptionId) {
      const current = await this.#userSubscriptionRepository.findById(
        BigInt(updated.replacesUserSubscriptionId),
      );

      if (current) {
        await this.#cancelAtCycleEndQuietly(
          current,
          `Cancel at cycle end for scheduled replacement ${updated.id}`,
        );
      }

      return updated;
    }

    await this.activateEntitlements(updated, {
      recordPreviousPlan: previousStatus === 'created',
    });

    return updated;
  }

  /**
   * Cancels other live subscriptions and writes users.SubscriptionId after payment/auth.
   * Optionally records a catalog-only previous plan (e.g. default Free) before this payment.
   * Period-end replacements stay off entitlements until the first successful charge (active).
   */
  async activateEntitlements(
    subscription: UserSubscription,
    options?: { recordPreviousPlan?: boolean },
  ): Promise<void> {
    if (subscription.replacesUserSubscriptionId && subscription.status !== 'active') {
      return;
    }

    if (!ENTITLEMENT_STATUSES.includes(subscription.status)) {
      return;
    }

    if (options?.recordPreviousPlan) {
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
    }

    await this.#supersedeOthers(subscription.userId, subscription.id);
    await this.#userEntitlementClient.setSubscriptionId(subscription.userId, subscription.planId);

    if (subscription.replacesUserSubscriptionId) {
      await this.#userSubscriptionRepository.update(BigInt(subscription.id), {
        replacesUserSubscriptionId: null,
        history: {
          eventSource: 'api_activate',
          eventType: 'subscription.period_end_activated',
          note: `Period-end replacement ${subscription.id} is now current`,
        },
      });
    }
  }

  /**
   * After a subscription becomes terminal/failed, assign Free only when the paid period is over
   * and no scheduled replacement is still waiting to charge.
   */
  async reconcilePeriodEnd(changed: UserSubscription): Promise<void> {
    const live = await this.#userSubscriptionRepository.findActiveByUserId(changed.userId);

    if (live && live.id !== changed.id) {
      return;
    }

    if (changed.replacesUserSubscriptionId) {
      const holder = await this.#userSubscriptionRepository.findById(
        BigInt(changed.replacesUserSubscriptionId),
      );

      if (holder && this.#hasRemainingPaidPeriod(holder)) {
        return;
      }

      await this.#assignFreeEntitlement(changed.userId, 'Scheduled replacement did not activate');
      return;
    }

    const scheduled = await this.#userSubscriptionRepository.findScheduledByUserId(changed.userId);

    if (scheduled && WAITING_SCHEDULED_STATUSES.includes(scheduled.status)) {
      return;
    }

    if (this.#hasRemainingPaidPeriod(changed) && LIVE_BILLING_STATUSES.includes(changed.status)) {
      return;
    }

    await this.#assignFreeEntitlement(changed.userId, `Fallback after ${changed.status}`);
  }

  async getCurrent(userId: string): Promise<CurrentUserSubscription | null> {
    let current = await this.#userSubscriptionRepository.findActiveByUserId(userId);
    const scheduled = await this.#userSubscriptionRepository.findScheduledByUserId(userId);

    if (!current && scheduled?.replacesUserSubscriptionId) {
      current = await this.#userSubscriptionRepository.findById(
        BigInt(scheduled.replacesUserSubscriptionId),
      );
    }

    if (!current) {
      return null;
    }

    return {
      ...current,
      scheduledChange: scheduled ? this.#toScheduledChange(scheduled) : null,
    };
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

    const isScheduledReplacement = Boolean(subscription.replacesUserSubscriptionId);
    const cancelAtCycleEnd = isScheduledReplacement ? false : (input.cancelAtCycleEnd ?? false);
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
        eventType: isScheduledReplacement
          ? 'scheduled_change.cancelled'
          : 'subscription.cancelled',
        note: isScheduledReplacement
          ? 'Scheduled plan change cancelled; current plan continues until period end then Free'
          : cancelAtCycleEnd
            ? 'Cancel at cycle end'
            : 'Cancel immediately',
      },
    });

    if (!updated) {
      throw new NotFoundError('Subscription');
    }

    if (!cancelAtCycleEnd && !isScheduledReplacement) {
      await this.#assignFreeEntitlement(userId, 'Paid subscription cancelled immediately');
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

  async #assignFreePlan(
    userId: string,
    plan: CatalogPlanWithRazorpay,
    billingCycle: CreateUserSubscriptionInput['billingCycle'],
    context: {
      inFlight: UserSubscription | null;
      billing: UserSubscription | null;
      scheduled: UserSubscription | null;
      activation: SubscriptionActivation;
    },
  ): Promise<CreateCheckoutResponse> {
    const previousPlanId = await this.#tryGetEntitlementPlanId(userId);

    if (context.inFlight) {
      await this.#cancelQuietly(context.inFlight, 'Abandoned checkout cancelled for free plan change');
    }

    if (context.scheduled) {
      await this.#cancelQuietly(
        context.scheduled,
        'Scheduled paid replacement cancelled for free plan at period end',
      );
    }

    if (context.billing && context.activation === 'period_end') {
      await this.#cancelAtCycleEndQuietly(
        context.billing,
        `Paid subscription will end at period end then switch to free plan ${plan.id}`,
      );
    } else if (context.billing) {
      await this.#cancelQuietly(context.billing, 'Paid subscription cancelled for free plan change');
      await this.#userEntitlementClient.setSubscriptionId(userId, plan.id);
    } else {
      await this.#userEntitlementClient.setSubscriptionId(userId, plan.id);
    }

    const entitlementChanged =
      context.activation === 'immediate' && (previousPlanId !== plan.id || Boolean(context.inFlight || context.billing));

    if (entitlementChanged || context.activation === 'period_end') {
      await this.#userSubscriptionRepository.createHistory({
        userId,
        planId: plan.id,
        billingCycle,
        eventSource: 'api_create',
        eventType: context.activation === 'period_end' ? 'plan.scheduled_free' : 'plan.assigned',
        note:
          context.activation === 'period_end'
            ? `Free plan scheduled after current period for plan ${context.billing?.planId ?? previousPlanId}`
            : context.billing
              ? `Free plan assigned after cancelling paid plan ${context.billing.planId}`
              : context.inFlight
                ? 'Free plan assigned after abandoning checkout'
                : 'Free plan assigned',
      });
    }

    return {
      subscriptionId: null,
      razorpaySubscriptionId: null,
      razorpayKeyId: null,
      checkoutRequired: false,
      activation: context.activation,
      status: 'none',
      plan,
      checkout: null,
    };
  }

  async #assignFreeEntitlement(userId: string, note: string): Promise<void> {
    const freePlan = await this.#userSubscriptionRepository.findFreeCatalogPlan();

    if (!freePlan) {
      logger.warn(
        {
          service: 'subscription-service',
          userId,
        },
        'could not resolve Free catalog plan for entitlement fallback',
      );
      return;
    }

    const currentPlanId = await this.#tryGetEntitlementPlanId(userId);

    if (currentPlanId === freePlan.id) {
      return;
    }

    await this.#userEntitlementClient.setSubscriptionId(userId, freePlan.id);
    await this.#userSubscriptionRepository.createHistory({
      userId,
      planId: freePlan.id,
      eventSource: 'webhook',
      eventType: 'plan.assigned',
      note,
    });
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
   * Records a catalog-only previous plan (typically Free set at registration).
   * Paid previous plans are already written by #supersedeOthers.
   */
  async #recordCurrentAtPayment(paid: UserSubscription): Promise<void> {
    const currentBilling = await this.#userSubscriptionRepository.findActiveByUserIdExcluding(
      paid.userId,
      BigInt(paid.id),
    );

    if (currentBilling) {
      return;
    }

    const currentPlanId = await this.#tryGetEntitlementPlanId(paid.userId);

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

  async #tryGetEntitlementPlanId(userId: string): Promise<number | null> {
    try {
      return await this.#userEntitlementClient.getSubscriptionId(userId);
    } catch (error) {
      logger.warn(
        {
          service: 'subscription-service',
          userId,
          err: error instanceof Error ? error.message : 'entitlement lookup failed',
        },
        'could not load current plan for history',
      );
      return null;
    }
  }

  async #cancelAtCycleEndQuietly(subscription: UserSubscription, note: string): Promise<void> {
    if (TERMINAL_STATUSES.includes(subscription.status)) {
      return;
    }

    if (subscription.cancelAtCycleEnd) {
      return;
    }

    let razorpayResult: {
      status: string;
      currentStart: number | null;
      currentEnd: number | null;
      chargeAt: number | null;
      paidCount: number;
      remainingCount: number | null;
      customerId: string | null;
    } | null = null;

    try {
      razorpayResult = await this.#razorpayClient.cancelSubscription(
        subscription.razorpaySubscriptionId,
        true,
      );
    } catch (error) {
      logger.warn(
        {
          service: 'subscription-service',
          userId: subscription.userId,
          razorpaySubscriptionId: subscription.razorpaySubscriptionId,
          err: error instanceof Error ? error.message : 'cancel at cycle end failed',
        },
        'razorpay cancel at cycle end during plan change failed',
      );
    }

    await this.#userSubscriptionRepository.update(BigInt(subscription.id), {
      status: razorpayResult ? this.#mapRazorpayStatus(razorpayResult.status) : subscription.status,
      cancelAtCycleEnd: true,
      cancelledAt: new Date(),
      endedAt: null,
      currentStart: razorpayResult
        ? this.#unixToDate(razorpayResult.currentStart)
        : subscription.currentStart,
      currentEnd: razorpayResult ? this.#unixToDate(razorpayResult.currentEnd) : subscription.currentEnd,
      chargeAt: razorpayResult ? this.#unixToDate(razorpayResult.chargeAt) : subscription.chargeAt,
      paidCount: razorpayResult ? razorpayResult.paidCount : subscription.paidCount,
      remainingCount: razorpayResult ? razorpayResult.remainingCount : subscription.remainingCount,
      razorpayCustomerId: razorpayResult ? razorpayResult.customerId : subscription.razorpayCustomerId,
      history: {
        eventSource: 'api_supersede',
        eventType: 'subscription.cancel_at_cycle_end',
        note,
      },
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

  #resolveActivation(
    billing: UserSubscription | null,
    plan: CatalogPlanWithRazorpay,
    billingCycle: CreateUserSubscriptionInput['billingCycle'],
    isPaid: boolean,
  ): SubscriptionActivation {
    if (!billing) {
      return 'immediate';
    }

    const costs = billing.plan
      ? { monthlyCost: billing.plan.monthlyCost, yearlyCost: billing.plan.yearlyCost }
      : { monthlyCost: '0', yearlyCost: '0' };

    return resolveSubscriptionActivation(
      {
        planId: billing.planId,
        billingCycle: billing.billingCycle,
        currentEnd: billing.currentEnd,
        costs,
      },
      {
        planId: plan.id,
        billingCycle,
        costs: plan,
        isPaid,
      },
    );
  }

  #hasRemainingPaidPeriod(subscription: UserSubscription): boolean {
    if (LIVE_BILLING_STATUSES.includes(subscription.status) && !subscription.endedAt) {
      if (!subscription.currentEnd) {
        return true;
      }

      return subscription.currentEnd.getTime() > Date.now();
    }

    return false;
  }

  #toScheduledChange(subscription: UserSubscription): ScheduledSubscriptionChange {
    const change: ScheduledSubscriptionChange = {
      id: subscription.id,
      planId: subscription.planId,
      billingCycle: subscription.billingCycle,
      status: subscription.status,
      scheduledStartAt: subscription.scheduledStartAt,
      chargeAt: subscription.chargeAt,
    };

    if (subscription.plan) {
      change.plan = subscription.plan;
    }

    return change;
  }

  #toCheckoutResponse(
    subscription: UserSubscription,
    plan: CatalogPlanWithRazorpay,
    activation: SubscriptionActivation,
  ): CreateCheckoutResponse {
    return {
      subscriptionId: subscription.id,
      razorpaySubscriptionId: subscription.razorpaySubscriptionId,
      razorpayKeyId: this.#razorpayClient.getKeyId(),
      checkoutRequired: true,
      activation,
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

  #dateToUnix(value: Date): number {
    return Math.floor(value.getTime() / 1000);
  }

  #parseId(id: string): bigint {
    if (!/^\d+$/.test(id)) {
      throw new BadRequestError('Invalid subscription id');
    }

    return BigInt(id);
  }
}
