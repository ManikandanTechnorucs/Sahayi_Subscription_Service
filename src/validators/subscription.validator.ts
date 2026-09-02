import { z } from 'zod';

const bearerAuthHeadersSchema = z.looseObject({
  authorization: z.string().regex(/^Bearer\s+\S+$/),
});

const trimRequiredString = (max: number) =>
  z.preprocess(
    (value) => (value === undefined || value === null ? value : String(value).trim()),
    z.string().min(1).max(max),
  );

const trimOptionalString = (max: number) =>
  z.preprocess(
    (value) => {
      if (value === undefined || value === null) {
        return undefined;
      }

      const trimmed = String(value).trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z.string().min(1).max(max).optional(),
  );

const nullableOptionalString = (max: number) =>
  z.preprocess(
    (value) => {
      if (value === null) {
        return null;
      }

      if (value === undefined) {
        return undefined;
      }

      const trimmed = String(value).trim();
      return trimmed.length > 0 ? trimmed : null;
    },
    z.union([z.string().max(max), z.null()]).optional(),
  );

const nonNegativeInt = z.number().int().min(0);

const subscriptionIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'id must be a positive integer'),
});

const createSubscriptionBodySchema = z
  .object({
    name: trimRequiredString(100),
    label: trimRequiredString(100),
    monthlyCost: trimRequiredString(10),
    yearlyCost: trimRequiredString(10),
    familyMembersLimit: nonNegativeInt,
    emergencyContactsLimit: nonNegativeInt,
    caregiverConnection: nonNegativeInt,
    caretakerConnection: nonNegativeInt,
    remindersLimit: trimRequiredString(10),
    emergencySOSalert: z.boolean(),
    wearableIntegration: z.boolean(),
    advancedReminderTracking: z.boolean(),
    advancedHealthMonitor: z.boolean(),
    advancedAINotification: z.boolean(),
    aiTextLimit: nullableOptionalString(50),
    aiVoiceLimit: nullableOptionalString(50),
    razorpayPlanIdMonthly: nullableOptionalString(40),
    razorpayPlanIdYearly: nullableOptionalString(40),
    isActive: z.boolean().optional(),
    syncRazorpay: z.boolean().optional(),
  })
  .strict();

const updateSubscriptionBodySchema = z
  .object({
    name: trimOptionalString(100),
    label: trimOptionalString(100),
    monthlyCost: trimOptionalString(10),
    yearlyCost: trimOptionalString(10),
    familyMembersLimit: nonNegativeInt.optional(),
    emergencyContactsLimit: nonNegativeInt.optional(),
    caregiverConnection: nonNegativeInt.optional(),
    caretakerConnection: nonNegativeInt.optional(),
    remindersLimit: trimOptionalString(10),
    emergencySOSalert: z.boolean().optional(),
    wearableIntegration: z.boolean().optional(),
    advancedReminderTracking: z.boolean().optional(),
    advancedHealthMonitor: z.boolean().optional(),
    advancedAINotification: z.boolean().optional(),
    aiTextLimit: nullableOptionalString(50),
    aiVoiceLimit: nullableOptionalString(50),
    razorpayPlanIdMonthly: nullableOptionalString(40),
    razorpayPlanIdYearly: nullableOptionalString(40),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    {
      message: 'At least one field must be provided for update',
    },
  );

export const listSubscriptionsSchema = {
  headers: bearerAuthHeadersSchema,
};

export const getSubscriptionSchema = {
  headers: bearerAuthHeadersSchema,
  params: subscriptionIdParamsSchema,
};

export const createSubscriptionSchema = {
  headers: bearerAuthHeadersSchema,
  body: createSubscriptionBodySchema,
};

export const updateSubscriptionSchema = {
  headers: bearerAuthHeadersSchema,
  params: subscriptionIdParamsSchema,
  body: updateSubscriptionBodySchema,
};

const syncRazorpayPlansBodySchema = z
  .object({
    ids: z.array(z.number().int().min(1)).min(1).max(100).optional(),
    force: z.boolean().optional(),
  })
  .strict();

const syncRazorpayPlanBodySchema = z
  .object({
    force: z.boolean().optional(),
  })
  .strict();

export const syncRazorpayPlansSchema = {
  headers: bearerAuthHeadersSchema,
  body: syncRazorpayPlansBodySchema.default({}),
};

export const syncRazorpayPlanSchema = {
  headers: bearerAuthHeadersSchema,
  params: subscriptionIdParamsSchema,
  body: syncRazorpayPlanBodySchema.default({}),
};
