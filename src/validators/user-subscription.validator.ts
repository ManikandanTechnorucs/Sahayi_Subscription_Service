import { z } from 'zod';

const bearerAuthHeadersSchema = z.looseObject({
  authorization: z.string().regex(/^Bearer\s+\S+$/),
});

const userSubscriptionIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'id must be a positive integer'),
});

const createUserSubscriptionBodySchema = z
  .object({
    planId: z.number().int().min(1),
    billingCycle: z.enum(['monthly', 'yearly']),
    totalCount: z.number().int().min(1).max(1200).optional(),
  })
  .strict();

const verifyUserSubscriptionBodySchema = z
  .object({
    razorpayPaymentId: z.string().min(1).max(40),
    razorpaySubscriptionId: z.string().min(1).max(40),
    razorpaySignature: z.string().min(1).max(128),
  })
  .strict();

const cancelUserSubscriptionBodySchema = z
  .object({
    cancelAtCycleEnd: z.boolean().optional(),
  })
  .strict()
  .default({});

export const createUserSubscriptionSchema = {
  headers: bearerAuthHeadersSchema,
  body: createUserSubscriptionBodySchema,
};

export const verifyUserSubscriptionSchema = {
  headers: bearerAuthHeadersSchema,
  body: verifyUserSubscriptionBodySchema,
};

export const getCurrentUserSubscriptionSchema = {
  headers: bearerAuthHeadersSchema,
};

export const getUserSubscriptionSchema = {
  headers: bearerAuthHeadersSchema,
  params: userSubscriptionIdParamsSchema,
};

export const cancelUserSubscriptionSchema = {
  headers: bearerAuthHeadersSchema,
  params: userSubscriptionIdParamsSchema,
  body: cancelUserSubscriptionBodySchema,
};

export const pauseUserSubscriptionSchema = {
  headers: bearerAuthHeadersSchema,
  params: userSubscriptionIdParamsSchema,
};

export const resumeUserSubscriptionSchema = {
  headers: bearerAuthHeadersSchema,
  params: userSubscriptionIdParamsSchema,
};
