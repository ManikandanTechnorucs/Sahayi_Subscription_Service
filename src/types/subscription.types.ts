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
