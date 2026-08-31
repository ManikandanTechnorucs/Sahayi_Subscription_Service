import type { NextFunction, Response } from 'express';
import { logger } from '../../libs/logger/src/logger';
import { response } from '../../libs/response/src/response';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';
import type { UserSubscriptionService } from '../services/user-subscription.service';
import type {
  CancelUserSubscriptionInput,
  CreateUserSubscriptionInput,
  VerifyUserSubscriptionInput,
} from '../types/user-subscription.types';

/**
 * Controller for authenticated user subscription lifecycle APIs.
 */
export class UserSubscriptionController {
  readonly #userSubscriptionService: UserSubscriptionService;

  constructor(userSubscriptionService: UserSubscriptionService) {
    this.#userSubscriptionService = userSubscriptionService;
    this.createSubscription = this.createSubscription.bind(this);
    this.verifyCheckout = this.verifyCheckout.bind(this);
    this.getCurrent = this.getCurrent.bind(this);
    this.getById = this.getById.bind(this);
    this.cancel = this.cancel.bind(this);
    this.pause = this.pause.bind(this);
    this.resume = this.resume.bind(this);
  }

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
        'create user subscription request received',
      );

      const data = await this.#userSubscriptionService.createSubscription(
        req.user.id,
        req.body as CreateUserSubscriptionInput,
      );

      res.status(201).json({
        ...response.DATA_SAVED,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyCheckout(
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
        'verify user subscription checkout request received',
      );

      const data = await this.#userSubscriptionService.verifyCheckout(
        req.user.id,
        req.body as VerifyUserSubscriptionInput,
      );

      res.status(200).json(response.createJson(response.SUCCESS_CODE, data));
    } catch (error) {
      next(error);
    }
  }

  async getCurrent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.info(
        {
          service: 'subscription-service',
          requestId: req.headers['x-request-id'],
          userId: req.user.id,
          method: req.method,
          path: req.path,
        },
        'get current user subscription request received',
      );

      const data = await this.#userSubscriptionService.getCurrent(req.user.id);

      if (!data) {
        res.status(200).json(response.NO_DATA_FOUND);
        return;
      }

      res.status(200).json(response.createJson(response.SUCCESS_CODE, data));
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
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
        'get user subscription request received',
      );

      const data = await this.#userSubscriptionService.getById(
        req.user.id,
        req.params.id as string,
      );

      res.status(200).json(response.createJson(response.SUCCESS_CODE, data));
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
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
        'cancel user subscription request received',
      );

      const data = await this.#userSubscriptionService.cancel(
        req.user.id,
        req.params.id as string,
        (req.body ?? {}) as CancelUserSubscriptionInput,
      );

      res.status(200).json({
        ...response.DATA_UPDATED,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async pause(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
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
        'pause user subscription request received',
      );

      const data = await this.#userSubscriptionService.pause(
        req.user.id,
        req.params.id as string,
      );

      res.status(200).json({
        ...response.DATA_UPDATED,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async resume(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
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
        'resume user subscription request received',
      );

      const data = await this.#userSubscriptionService.resume(
        req.user.id,
        req.params.id as string,
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
