import type { SubscriptionPlan } from './subscription.types';

export type BillingCycle = 'monthly' | 'yearly';

export type UserSubscriptionStatus =
  | 'created'
  | 'authenticated'
  | 'active'
  | 'pending'
  | 'halted'
  | 'paused'
  | 'cancelled'
  | 'completed'
  | 'expired';

/**
 * User-facing subscription instance (local source of truth).
 */
export type UserSubscription = {
  id: string;
  userId: string;
  planId: number;
  billingCycle: BillingCycle;
  status: UserSubscriptionStatus;
  razorpaySubscriptionId: string;
  razorpayCustomerId: string | null;
  razorpayPlanId: string;
  totalCount: number;
  paidCount: number;
  remainingCount: number | null;
  quantity: number;
  currentStart: Date | null;
  currentEnd: Date | null;
  chargeAt: Date | null;
  checkoutVerifiedAt: Date | null;
  cancelledAt: Date | null;
  cancelAtCycleEnd: boolean;
  pausedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
  plan?: SubscriptionPlan;
};

export type CreateUserSubscriptionInput = {
  planId: number;
  billingCycle: BillingCycle;
  totalCount?: number;
};

export type VerifyUserSubscriptionInput = {
  razorpayPaymentId: string;
  razorpaySubscriptionId: string;
  razorpaySignature: string;
};

export type CancelUserSubscriptionInput = {
  cancelAtCycleEnd?: boolean;
};

export type CreateCheckoutResponse = {
  subscriptionId: string | null;
  razorpaySubscriptionId: string | null;
  razorpayKeyId: string | null;
  checkoutRequired: boolean;
  status: UserSubscriptionStatus | 'none';
  plan: SubscriptionPlan;
  checkout: {
    subscriptionId: string;
    name: string;
    description: string;
    prefill: {
      contact: string | null;
      email: string | null;
      name: string | null;
    };
  } | null;
};
