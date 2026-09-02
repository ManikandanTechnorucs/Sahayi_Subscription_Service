import { Router } from 'express';
import { validate } from '../../libs/validation/src/validate';
import { container } from '../container';
import {
  asAuthenticatedHandler,
  authMiddleware,
  requireAccessToken,
} from '../middlewares/auth.middleware';
import {
  createSubscriptionSchema,
  getSubscriptionSchema,
  listSubscriptionsSchema,
  syncRazorpayPlanSchema,
  syncRazorpayPlansSchema,
  updateSubscriptionSchema,
} from '../validators/subscription.validator';

const router = Router();

router.get(
  '/',
  authMiddleware,
  requireAccessToken,
  validate(listSubscriptionsSchema),
  asAuthenticatedHandler(container.subscriptionController.listSubscriptions),
);

router.post(
  '/',
  authMiddleware,
  requireAccessToken,
  validate(createSubscriptionSchema),
  asAuthenticatedHandler(container.subscriptionController.createSubscription),
);

router.post(
  '/sync-razorpay',
  authMiddleware,
  requireAccessToken,
  validate(syncRazorpayPlansSchema),
  asAuthenticatedHandler(container.subscriptionController.syncRazorpayPlans),
);

router.post(
  '/:id/sync-razorpay',
  authMiddleware,
  requireAccessToken,
  validate(syncRazorpayPlanSchema),
  asAuthenticatedHandler(container.subscriptionController.syncRazorpayPlan),
);

router.get(
  '/:id',
  authMiddleware,
  requireAccessToken,
  validate(getSubscriptionSchema),
  asAuthenticatedHandler(container.subscriptionController.getSubscription),
);

router.put(
  '/:id',
  authMiddleware,
  requireAccessToken,
  validate(updateSubscriptionSchema),
  asAuthenticatedHandler(container.subscriptionController.updateSubscription),
);

export default router;
