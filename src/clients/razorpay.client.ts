import Razorpay from 'razorpay';
import { validatePaymentVerification, validateWebhookSignature } from 'razorpay/dist/utils/razorpay-utils';
import { config } from '../../libs/config/src/config';
import { logger } from '../../libs/logger/src/logger';
import { BadRequestError, ServiceUnavailableError } from '../errors/app-error';

export type CreateRazorpaySubscriptionInput = {
  planId: string;
  totalCount: number;
  quantity?: number;
  notes?: Record<string, string>;
};

export type RazorpaySubscriptionResult = {
  id: string;
  status: string;
  planId: string;
  totalCount: number;
  quantity: number;
  customerId: string | null;
  currentStart: number | null;
  currentEnd: number | null;
  chargeAt: number | null;
  paidCount: number;
  remainingCount: number | null;
  shortUrl: string | null;
};

/**
 * Thin Razorpay SDK wrapper. Controllers/services must not call the SDK directly.
 */
export class RazorpayClient {
  readonly #client: Razorpay | null;

  constructor() {
    if (config.RAZORPAY_KEY_ID && config.RAZORPAY_KEY_SECRET) {
      this.#client = new Razorpay({
        key_id: config.RAZORPAY_KEY_ID,
        key_secret: config.RAZORPAY_KEY_SECRET,
      });
    } else {
      this.#client = null;
    }
  }

  getKeyId(): string {
    this.#assertConfigured();
    return config.RAZORPAY_KEY_ID;
  }

  /**
   * Creates a Razorpay subscription for checkout authorization.
   */
  async createSubscription(input: CreateRazorpaySubscriptionInput): Promise<RazorpaySubscriptionResult> {
    const client = this.#assertConfigured();

    try {
      const created = await client.subscriptions.create({
        plan_id: input.planId,
        total_count: input.totalCount,
        quantity: input.quantity ?? 1,
        customer_notify: 1,
        notes: input.notes ?? {},
      });

      return this.#mapSubscription(created as unknown as Record<string, unknown>);
    } catch (error) {
      this.#logAndThrow('create subscription failed', error);
    }
  }

  async fetchSubscription(razorpaySubscriptionId: string): Promise<RazorpaySubscriptionResult> {
    const client = this.#assertConfigured();

    try {
      const fetched = await client.subscriptions.fetch(razorpaySubscriptionId);
      return this.#mapSubscription(fetched as unknown as Record<string, unknown>);
    } catch (error) {
      this.#logAndThrow('fetch subscription failed', error);
    }
  }

  async cancelSubscription(
    razorpaySubscriptionId: string,
    cancelAtCycleEnd: boolean,
  ): Promise<RazorpaySubscriptionResult> {
    const client = this.#assertConfigured();

    try {
      const cancelled = await client.subscriptions.cancel(razorpaySubscriptionId, cancelAtCycleEnd);
      return this.#mapSubscription(cancelled as unknown as Record<string, unknown>);
    } catch (error) {
      this.#logAndThrow('cancel subscription failed', error);
    }
  }

  async pauseSubscription(razorpaySubscriptionId: string): Promise<RazorpaySubscriptionResult> {
    const client = this.#assertConfigured();

    try {
      const paused = await client.subscriptions.pause(razorpaySubscriptionId, {
        pause_at: 'now',
      });
      return this.#mapSubscription(paused as unknown as Record<string, unknown>);
    } catch (error) {
      this.#logAndThrow('pause subscription failed', error);
    }
  }

  async resumeSubscription(razorpaySubscriptionId: string): Promise<RazorpaySubscriptionResult> {
    const client = this.#assertConfigured();

    try {
      const resumed = await client.subscriptions.resume(razorpaySubscriptionId, {
        resume_at: 'now',
      });
      return this.#mapSubscription(resumed as unknown as Record<string, unknown>);
    } catch (error) {
      this.#logAndThrow('resume subscription failed', error);
    }
  }

  /**
   * Verifies checkout signature for a subscription authorization payment.
   */
  verifySubscriptionPayment(input: {
    razorpayPaymentId: string;
    razorpaySubscriptionId: string;
    razorpaySignature: string;
  }): boolean {
    this.#assertConfigured();

    try {
      return validatePaymentVerification(
        {
          subscription_id: input.razorpaySubscriptionId,
          payment_id: input.razorpayPaymentId,
        },
        input.razorpaySignature,
        config.RAZORPAY_KEY_SECRET,
      );
    } catch (error) {
      logger.warn(
        {
          service: 'subscription-service',
          err: error instanceof Error ? error.message : 'signature verify error',
        },
        'razorpay payment signature verification error',
      );
      return false;
    }
  }

  /**
   * Verifies webhook HMAC over the raw request body.
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!config.RAZORPAY_WEBHOOK_SECRET) {
      throw new ServiceUnavailableError('Razorpay webhook secret is not configured');
    }

    try {
      return validateWebhookSignature(rawBody, signature, config.RAZORPAY_WEBHOOK_SECRET);
    } catch (error) {
      logger.warn(
        {
          service: 'subscription-service',
          err: error instanceof Error ? error.message : 'webhook verify error',
        },
        'razorpay webhook signature verification error',
      );
      return false;
    }
  }

  #assertConfigured(): Razorpay {
    if (!this.#client || !config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) {
      throw new ServiceUnavailableError('Razorpay is not configured');
    }

    return this.#client;
  }

  #mapSubscription(raw: Record<string, unknown>): RazorpaySubscriptionResult {
    return {
      id: String(raw.id),
      status: String(raw.status ?? 'created'),
      planId: String(raw.plan_id ?? ''),
      totalCount: Number(raw.total_count ?? 0),
      quantity: Number(raw.quantity ?? 1),
      customerId: raw.customer_id ? String(raw.customer_id) : null,
      currentStart: typeof raw.current_start === 'number' ? raw.current_start : null,
      currentEnd: typeof raw.current_end === 'number' ? raw.current_end : null,
      chargeAt: typeof raw.charge_at === 'number' ? raw.charge_at : null,
      paidCount: Number(raw.paid_count ?? 0),
      remainingCount:
        raw.remaining_count === null || raw.remaining_count === undefined
          ? null
          : Number(raw.remaining_count),
      shortUrl: raw.short_url ? String(raw.short_url) : null,
    };
  }

  #logAndThrow(message: string, error: unknown): never {
    const detail =
      error && typeof error === 'object' && 'error' in error
        ? JSON.stringify((error as { error: unknown }).error)
        : error instanceof Error
          ? error.message
          : 'unknown razorpay error';

    logger.error(
      {
        service: 'subscription-service',
        detail,
      },
      message,
    );

    throw new BadRequestError(`Razorpay request failed: ${message}`, 'RAZORPAY_ERROR');
  }
}
