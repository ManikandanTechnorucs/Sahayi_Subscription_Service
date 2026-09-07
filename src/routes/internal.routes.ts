import { Router } from 'express';
import { validate } from '../../libs/validation/src/validate';
import { container } from '../container';
import { requireInternalServiceToken } from '../middlewares/internal-auth.middleware';
import { internalSyncRazorpayPlanSchema } from '../validators/internal.validator';

const router = Router();

router.post(
  '/subscriptions/:id/sync-razorpay',
  requireInternalServiceToken,
  validate(internalSyncRazorpayPlanSchema),
  container.internalSubscriptionController.syncRazorpayPlan,
);

export default router;
