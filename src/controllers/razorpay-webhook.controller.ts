import type { NextFunction, Request, Response } from 'express';
import { logger } from '../../libs/logger/src/logger';
import { response } from '../../libs/response/src/response';
import type { RazorpayWebhookService } from '../services/razorpay-webhook.service';

type RawBodyRequest = Request & {
  body: Buffer;
};

/**
 * Controller for Razorpay webhook ingestion.
 */
export class RazorpayWebhookController {
  readonly #razorpayWebhookService: RazorpayWebhookService;

  constructor(razorpayWebhookService: RazorpayWebhookService) {
    this.#razorpayWebhookService = razorpayWebhookService;
    this.handle = this.handle.bind(this);
  }

  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawReq = req as RawBodyRequest;
      const rawBody = Buffer.isBuffer(rawReq.body)
        ? rawReq.body.toString('utf8')
        : typeof rawReq.body === 'string'
          ? rawReq.body
          : '';

      const signatureHeader = req.headers['x-razorpay-signature'];
      const eventIdHeader = req.headers['x-razorpay-event-id'];
      const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
      const eventId = Array.isArray(eventIdHeader) ? eventIdHeader[0] : eventIdHeader;

      logger.info(
        {
          service: 'subscription-service',
          requestId: req.headers['x-request-id'],
          method: req.method,
          path: req.path,
          eventId,
        },
        'razorpay webhook request received',
      );

      const result = await this.#razorpayWebhookService.handleWebhook({
        rawBody,
        signature,
        eventId,
      });

      res.status(200).json(
        response.createJson(response.SUCCESS_CODE, {
          received: true,
          duplicate: result.duplicate,
          ignored: result.ignored,
        }),
      );
    } catch (error) {
      next(error);
    }
  }
}
