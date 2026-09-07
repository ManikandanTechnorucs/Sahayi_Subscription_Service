import type { NextFunction, Request, Response } from 'express';
import { logger } from '../../libs/logger/src/logger';
import { response } from '../../libs/response/src/response';
import type { SubscriptionService } from '../services/subscription.service';

/**
 * Internal catalog sync invoked by Admin Service after plan create/update.
 */
export class InternalSubscriptionController {
  readonly #subscriptionService: SubscriptionService;

  constructor(subscriptionService: SubscriptionService) {
    this.#subscriptionService = subscriptionService;
    this.syncRazorpayPlan = this.syncRazorpayPlan.bind(this);
  }

  async syncRazorpayPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.info(
        {
          service: 'subscription-service',
          requestId: req.headers['x-request-id'],
          method: req.method,
          path: req.path,
          subscriptionId: req.params.id,
        },
        'internal razorpay catalog sync request received',
      );

      const force = Boolean((req.body as { force?: boolean } | undefined)?.force);
      const data = await this.#subscriptionService.syncRazorpayPlan(
        req.params.id as string,
        force,
      );

      res.status(200).json({
        ...response.DATA_UPDATED,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}
