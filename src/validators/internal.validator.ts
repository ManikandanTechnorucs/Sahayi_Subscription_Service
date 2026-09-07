import { z } from 'zod';

export const internalSyncRazorpayPlanSchema = {
  headers: z.looseObject({
    'x-internal-service-token': z.string().min(1),
  }),
  params: z.object({
    id: z.string().regex(/^\d+$/, 'id must be a positive integer'),
  }),
  body: z
    .object({
      force: z.boolean().optional(),
    })
    .strict()
    .default({}),
};
