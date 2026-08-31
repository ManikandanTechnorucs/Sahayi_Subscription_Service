import { Router } from 'express';
import { validate } from '../../libs/validation/src/validate';
import { container } from '../container';
import {
  asAuthenticatedHandler,
  authMiddleware,
  requireAccessToken,
} from '../middlewares/auth.middleware';
import {
  cancelUserSubscriptionSchema,
  createUserSubscriptionSchema,
  getCurrentUserSubscriptionSchema,
  getUserSubscriptionSchema,
  pauseUserSubscriptionSchema,
  resumeUserSubscriptionSchema,
  verifyUserSubscriptionSchema,
} from '../validators/user-subscription.validator';

const router = Router();

router.post(
  '/',
  authMiddleware,
  requireAccessToken,
  validate(createUserSubscriptionSchema),
  asAuthenticatedHandler(container.userSubscriptionController.createSubscription),
);

router.post(
  '/verify',
  authMiddleware,
  requireAccessToken,
  validate(verifyUserSubscriptionSchema),
  asAuthenticatedHandler(container.userSubscriptionController.verifyCheckout),
);

router.get(
  '/current',
  authMiddleware,
  requireAccessToken,
  validate(getCurrentUserSubscriptionSchema),
  asAuthenticatedHandler(container.userSubscriptionController.getCurrent),
);

router.get(
  '/:id',
  authMiddleware,
  requireAccessToken,
  validate(getUserSubscriptionSchema),
  asAuthenticatedHandler(container.userSubscriptionController.getById),
);

router.post(
  '/:id/cancel',
  authMiddleware,
  requireAccessToken,
  validate(cancelUserSubscriptionSchema),
  asAuthenticatedHandler(container.userSubscriptionController.cancel),
);

router.post(
  '/:id/pause',
  authMiddleware,
  requireAccessToken,
  validate(pauseUserSubscriptionSchema),
  asAuthenticatedHandler(container.userSubscriptionController.pause),
);

router.post(
  '/:id/resume',
  authMiddleware,
  requireAccessToken,
  validate(resumeUserSubscriptionSchema),
  asAuthenticatedHandler(container.userSubscriptionController.resume),
);

export default router;
