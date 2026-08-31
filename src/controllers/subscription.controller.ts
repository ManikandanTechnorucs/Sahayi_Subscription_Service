import type { NextFunction, Response } from 'express';
import { logger } from '../../libs/logger/src/logger';
import { response } from '../../libs/response/src/response';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';
import type { SubscriptionService } from '../services/subscription.service';
import type {
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
} from '../types/subscription.types';

/**
 * Controller responsible for subscription plan HTTP request handling.
 */
export class SubscriptionController {
  readonly #subscriptionService: SubscriptionService;

  constructor(subscriptionService: SubscriptionService) {
    this.#subscriptionService = subscriptionService;
    this.listSubscriptions = this.listSubscriptions.bind(this);
    this.getSubscription = this.getSubscription.bind(this);
    this.createSubscription = this.createSubscription.bind(this);
    this.updateSubscription = this.updateSubscription.bind(this);
  }

  /**
   * Returns active subscription plans.
   */
  async listSubscriptions(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      logger.info(
        {
          service: 'subscription-service',
          requestId: req.headers['x-request-id'],
          userId: req.user.id,
          method: req.method,
          path: req.path,
        },
        'list subscriptions request received',
      );

      const subscriptions = await this.#subscriptionService.listSubscriptions();

      if (subscriptions.length === 0) {
        res.status(200).json(response.NO_DATA_FOUND);
        return;
      }

      res
        .status(200)
        .json(response.createJson(response.SUCCESS_CODE, subscriptions, subscriptions.length));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Returns a subscription plan by id.
   */
  async getSubscription(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      logger.info(
        {
          service: 'subscription-service',
          requestId: req.headers['x-request-id'],
          userId: req.user.id,
          method: req.method,
          path: req.path,
          subscriptionId: req.params.id,
        },
        'get subscription request received',
      );

      const subscription = await this.#subscriptionService.getSubscription(req.params.id as string);

      res.status(200).json(response.createJson(response.SUCCESS_CODE, subscription));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Creates a subscription plan.
   */
  async createSubscription(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      logger.info(
        {
          service: 'subscription-service',
          requestId: req.headers['x-request-id'],
          userId: req.user.id,
          method: req.method,
          path: req.path,
        },
        'create subscription request received',
      );

      const subscription = await this.#subscriptionService.createSubscription(
        req.body as CreateSubscriptionInput,
      );

      res.status(201).json({
        ...response.DATA_SAVED,
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Updates a subscription plan by id.
   */
  async updateSubscription(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      logger.info(
        {
          service: 'subscription-service',
          requestId: req.headers['x-request-id'],
          userId: req.user.id,
          method: req.method,
          path: req.path,
          subscriptionId: req.params.id,
        },
        'update subscription request received',
      );

      const subscription = await this.#subscriptionService.updateSubscription(
        req.params.id as string,
        req.body as UpdateSubscriptionInput,
      );

      res.status(200).json({
        ...response.DATA_UPDATED,
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  }
}
