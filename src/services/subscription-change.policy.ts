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
 * Paid cycles have a catalog price greater than zero.
 */
export function isPaidCatalogCycle(costs: CatalogCycleCosts, billingCycle: BillingCycle): boolean {
  return catalogCyclePrice(costs, billingCycle) > 0;
}

/**
 * Upgrade (same cycle, higher price) is immediate.
 * Downgrade, Free, and same-plan cycle switches wait until period end.
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

  if (current.planId === target.planId && current.billingCycle !== target.billingCycle) {
    return 'period_end';
  }

  const currentPrice = catalogCyclePrice(current.costs, current.billingCycle);
  const targetPrice = catalogCyclePrice(target.costs, target.billingCycle);

  if (targetPrice > currentPrice) {
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
