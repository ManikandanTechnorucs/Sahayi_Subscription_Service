import type { RazorpayClient } from '../clients/razorpay.client';
import { BadRequestError, ConflictError, NotFoundError } from '../errors/app-error';
import type { SubscriptionRepository } from '../repositories/subscription.repository';
import type {
  CreateSubscriptionInput,
  RazorpayPlanSyncCycleResult,
  SubscriptionPlan,
  SyncRazorpayPlanResult,
  SyncRazorpayPlansInput,
  SyncRazorpayPlansResult,
  UpdateSubscriptionInput,
} from '../types/subscription.types';

/**
 * Service responsible for subscription plan catalog business logic.
 */
export class SubscriptionService {
  readonly #subscriptionRepository: SubscriptionRepository;
  readonly #razorpayClient: RazorpayClient;

  constructor(
    subscriptionRepository: SubscriptionRepository,
    razorpayClient: RazorpayClient,
  ) {
    this.#subscriptionRepository = subscriptionRepository;
    this.#razorpayClient = razorpayClient;
  }

  /**
   * Returns active subscription plans.
   */
  async listSubscriptions(): Promise<SubscriptionPlan[]> {
    return this.#subscriptionRepository.findActiveSubscriptions();
  }

  /**
   * Returns a subscription plan by id.
   */
  async getSubscription(id: string): Promise<SubscriptionPlan> {
    const parsedId = this.#parseId(id);
    const subscription = await this.#subscriptionRepository.findById(parsedId);

    if (!subscription) {
      throw new NotFoundError('Subscription');
    }

    return subscription;
  }

  /**
   * Creates a subscription plan and optionally syncs Razorpay catalog plans.
   */
  async createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionPlan> {
    const existingByName = await this.#subscriptionRepository.findByName(input.name);
    const existingByLabel = await this.#subscriptionRepository.findByLabel(input.label);

    if (existingByName || existingByLabel) {
      throw new ConflictError('Subscription name or label already exists');
    }

    const syncRazorpay = input.syncRazorpay !== false;
    let razorpayPlanIdMonthly = input.razorpayPlanIdMonthly ?? null;
    let razorpayPlanIdYearly = input.razorpayPlanIdYearly ?? null;

    if (syncRazorpay) {
      const synced = await this.#ensureRazorpayPlans({
        name: input.name,
        label: input.label,
        monthlyCost: input.monthlyCost,
        yearlyCost: input.yearlyCost,
        razorpayPlanIdMonthly,
        razorpayPlanIdYearly,
      });

      razorpayPlanIdMonthly = synced.monthly.razorpayPlanId;
      razorpayPlanIdYearly = synced.yearly.razorpayPlanId;
    }

    return this.#subscriptionRepository.create({
      ...input,
      razorpayPlanIdMonthly,
      razorpayPlanIdYearly,
    });
  }

  /**
   * Updates a subscription plan by id.
   */
  async updateSubscription(id: string, input: UpdateSubscriptionInput): Promise<SubscriptionPlan> {
    const hasUpdateField = Object.values(input).some((value) => value !== undefined);

    if (!hasUpdateField) {
      throw new BadRequestError('At least one field must be provided for update');
    }

    const parsedId = this.#parseId(id);
    const updated = await this.#subscriptionRepository.update(parsedId, input);

    if (!updated) {
      throw new NotFoundError('Subscription');
    }

    return updated;
  }

  /**
   * Creates missing Razorpay plans for one catalog record and persists the ids.
   */
  async syncRazorpayPlan(id: string, force = false): Promise<SyncRazorpayPlanResult> {
    const parsedId = this.#parseId(id);
    const plan = await this.#subscriptionRepository.findById(parsedId);

    if (!plan) {
      throw new NotFoundError('Subscription');
    }

    return this.#syncCatalogPlan(plan, force);
  }

  /**
   * Creates missing Razorpay plans for selected or all active catalog records.
   */
  async syncRazorpayPlans(input: SyncRazorpayPlansInput): Promise<SyncRazorpayPlansResult> {
    const force = input.force === true;
    let plans: SubscriptionPlan[];

    if (input.ids && input.ids.length > 0) {
      plans = await this.#subscriptionRepository.findByIds(input.ids);
      const foundIds = new Set(plans.map((plan) => plan.id));
      const missing = input.ids.filter((id) => !foundIds.has(id));

      if (missing.length > 0) {
        throw new NotFoundError(`Subscription (${missing.join(', ')})`);
      }
    } else {
      plans = await this.#subscriptionRepository.findActiveSubscriptions();
    }

    const results: SyncRazorpayPlanResult[] = [];

    for (const plan of plans) {
      results.push(await this.#syncCatalogPlan(plan, force));
    }

    return {
      count: results.length,
      results,
    };
  }

  async #syncCatalogPlan(plan: SubscriptionPlan, force: boolean): Promise<SyncRazorpayPlanResult> {
    const synced = await this.#ensureRazorpayPlans(
      {
        name: plan.name,
        label: plan.label,
        monthlyCost: plan.monthlyCost,
        yearlyCost: plan.yearlyCost,
        razorpayPlanIdMonthly: plan.razorpayPlanIdMonthly,
        razorpayPlanIdYearly: plan.razorpayPlanIdYearly,
        localPlanId: plan.id,
      },
      force,
    );

    const monthlyChanged = synced.monthly.razorpayPlanId !== plan.razorpayPlanIdMonthly;
    const yearlyChanged = synced.yearly.razorpayPlanId !== plan.razorpayPlanIdYearly;

    const nextPlan =
      monthlyChanged || yearlyChanged
        ? await this.#subscriptionRepository.update(plan.id, {
            razorpayPlanIdMonthly: synced.monthly.razorpayPlanId,
            razorpayPlanIdYearly: synced.yearly.razorpayPlanId,
          })
        : plan;

    return {
      plan: nextPlan ?? plan,
      monthly: synced.monthly,
      yearly: synced.yearly,
    };
  }

  async #ensureRazorpayPlans(
    plan: {
      name: string;
      label: string;
      monthlyCost: string;
      yearlyCost: string;
      razorpayPlanIdMonthly: string | null;
      razorpayPlanIdYearly: string | null;
      localPlanId?: number;
    },
    force = false,
  ): Promise<{ monthly: RazorpayPlanSyncCycleResult; yearly: RazorpayPlanSyncCycleResult }> {
    const monthly = await this.#syncCycle({
      billingCycle: 'monthly',
      cost: plan.monthlyCost,
      existingId: plan.razorpayPlanIdMonthly,
      force,
      name: plan.name,
      label: plan.label,
      ...(plan.localPlanId !== undefined ? { localPlanId: plan.localPlanId } : {}),
    });

    const yearly = await this.#syncCycle({
      billingCycle: 'yearly',
      cost: plan.yearlyCost,
      existingId: plan.razorpayPlanIdYearly,
      force,
      name: plan.name,
      label: plan.label,
      ...(plan.localPlanId !== undefined ? { localPlanId: plan.localPlanId } : {}),
    });

    return { monthly, yearly };
  }

  async #syncCycle(input: {
    billingCycle: 'monthly' | 'yearly';
    cost: string;
    existingId: string | null;
    force: boolean;
    name: string;
    label: string;
    localPlanId?: number;
  }): Promise<RazorpayPlanSyncCycleResult> {
    const amountPaise = this.#toPaise(input.cost);

    if (amountPaise <= 0) {
      return {
        action: 'skipped',
        razorpayPlanId: null,
        reason: 'Free plans are not synced to Razorpay',
      };
    }

    if (input.existingId && !input.force) {
      return {
        action: 'existing',
        razorpayPlanId: input.existingId,
      };
    }

    const created = await this.#razorpayClient.createPlan({
      period: input.billingCycle,
      interval: 1,
      name: `${input.label} (${input.billingCycle})`,
      amountPaise,
      description: input.label,
      notes: {
        localName: input.name,
        billingCycle: input.billingCycle,
        ...(input.localPlanId ? { localPlanId: String(input.localPlanId) } : {}),
      },
    });

    return {
      action: 'created',
      razorpayPlanId: created.id,
    };
  }

  #toPaise(cost: string): number {
    const amount = Number(cost);

    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestError(`Invalid plan cost: ${cost}`);
    }

    return Math.round(amount * 100);
  }

  #parseId(id: string): number {
    const parsed = Number(id);

    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new BadRequestError('Invalid subscription id');
    }

    return parsed;
  }
}
