import type { BillingCycle, SubscriptionActivation } from '../types/user-subscription.types';

export type { SubscriptionActivation };

export type CatalogCycleCosts = {
  monthlyCost: string;
  yearlyCost: string;
};

export type CurrentChangeSnapshot = {
  planId: number;
  billingCycle: BillingCycle;
  currentEnd: Date | null;
  cancelAtCycleEnd?: boolean;
  costs: CatalogCycleCosts;
};

export type TargetChangeSnapshot = {
  planId: number;
  billingCycle: BillingCycle;
  costs: CatalogCycleCosts;
  isPaid: boolean;
};

/**
 * Reads the catalog price for a billing cycle.
 */
export function catalogCyclePrice(costs: CatalogCycleCosts, billingCycle: BillingCycle): number {
  const raw = billingCycle === 'monthly' ? costs.monthlyCost : costs.yearlyCost;
  const amount = Number(raw);
  return Number.isFinite(amount) ? amount : 0;
}

/**
 * Plan-tier comparison uses monthly catalog cost, not the selected cycle invoice.
 */
export function catalogMonthlyPrice(costs: CatalogCycleCosts): number {
  const amount = Number(costs.monthlyCost);
  return Number.isFinite(amount) ? amount : 0;
}

/**
 * Paid cycles have a catalog price greater than zero.
 */
export function isPaidCatalogCycle(costs: CatalogCycleCosts, billingCycle: BillingCycle): boolean {
  return catalogCyclePrice(costs, billingCycle) > 0;
}

/**
 * Upgrade (higher monthly catalog cost) is immediate and forfeits the current period.
 * Downgrade, Free, same-plan cycle switches, and undo-cancel continuations wait until period end.
 * Missing CurrentEnd falls back to immediate.
 */
export function resolveSubscriptionActivation(
  current: CurrentChangeSnapshot | null,
  target: TargetChangeSnapshot,
): SubscriptionActivation {
  if (!current) {
    return 'immediate';
  }

  if (!current.currentEnd) {
    return 'immediate';
  }

  if (!target.isPaid) {
    return 'period_end';
  }

  if (current.planId === target.planId && current.billingCycle === target.billingCycle) {
    return current.cancelAtCycleEnd ? 'period_end' : 'immediate';
  }

  if (current.planId === target.planId && current.billingCycle !== target.billingCycle) {
    return 'period_end';
  }

  const currentMonthly = catalogMonthlyPrice(current.costs);
  const targetMonthly = catalogMonthlyPrice(target.costs);

  if (targetMonthly > currentMonthly) {
    return 'immediate';
  }

  return 'period_end';
}

/**
 * Earliest Razorpay start_at that is still a period-end change.
 * If CurrentEnd is too soon, delay to the minimum offset instead of forfeiting now.
 */
export function resolveScheduledStartAt(
  currentEnd: Date,
  now: Date,
  minOffsetSeconds: number,
): Date {
  const minStart = new Date(now.getTime() + minOffsetSeconds * 1000);

  if (currentEnd.getTime() >= minStart.getTime()) {
    return currentEnd;
  }

  return minStart;
}
