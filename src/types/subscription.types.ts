/**
 * Subscription plan returned by subscription APIs.
 */
export type SubscriptionPlan = {
  id: number;
  name: string;
  label: string;
  monthlyCost: string;
  yearlyCost: string;
  familyMembersLimit: number;
  emergencyContactsLimit: number;
  caregiverConnection: number;
  caretakerConnection: number;
  remindersLimit: string;
  emergencySOSalert: boolean;
  wearableIntegration: boolean;
  advancedReminderTracking: boolean;
  advancedHealthMonitor: boolean;
  advancedAINotification: boolean;
  aiTextLimit: string | null;
  aiVoiceLimit: string | null;
  razorpayPlanIdMonthly: string | null;
  razorpayPlanIdYearly: string | null;
};

/**
 * Input for creating a subscription plan.
 */
export type CreateSubscriptionInput = {
  name: string;
  label: string;
  monthlyCost: string;
  yearlyCost: string;
  familyMembersLimit: number;
  emergencyContactsLimit: number;
  caregiverConnection: number;
  caretakerConnection: number;
  remindersLimit: string;
  emergencySOSalert: boolean;
  wearableIntegration: boolean;
  advancedReminderTracking: boolean;
  advancedHealthMonitor: boolean;
  advancedAINotification: boolean;
  aiTextLimit?: string | null;
  aiVoiceLimit?: string | null;
  razorpayPlanIdMonthly?: string | null;
  razorpayPlanIdYearly?: string | null;
  isActive?: boolean;
  /**
   * When true (default), create Razorpay monthly/yearly plans for paid costs
   * and persist the returned plan ids. Free (0) cycles are skipped.
   */
  syncRazorpay?: boolean;
};

/**
 * Input for updating a subscription plan.
 */
export type UpdateSubscriptionInput = {
  name?: string;
  label?: string;
  monthlyCost?: string;
  yearlyCost?: string;
  familyMembersLimit?: number;
  emergencyContactsLimit?: number;
  caregiverConnection?: number;
  caretakerConnection?: number;
  remindersLimit?: string;
  emergencySOSalert?: boolean;
  wearableIntegration?: boolean;
  advancedReminderTracking?: boolean;
  advancedHealthMonitor?: boolean;
  advancedAINotification?: boolean;
  aiTextLimit?: string | null;
  aiVoiceLimit?: string | null;
  razorpayPlanIdMonthly?: string | null;
  razorpayPlanIdYearly?: string | null;
  isActive?: boolean;
};

export type RazorpayPlanSyncAction = 'created' | 'existing' | 'skipped';

export type RazorpayPlanSyncCycleResult = {
  action: RazorpayPlanSyncAction;
  razorpayPlanId: string | null;
  reason?: string;
};

export type SyncRazorpayPlanResult = {
  plan: SubscriptionPlan;
  monthly: RazorpayPlanSyncCycleResult;
  yearly: RazorpayPlanSyncCycleResult;
};

export type SyncRazorpayPlansInput = {
  ids?: number[];
  force?: boolean;
};

export type SyncRazorpayPlansResult = {
  count: number;
  results: SyncRazorpayPlanResult[];
};
