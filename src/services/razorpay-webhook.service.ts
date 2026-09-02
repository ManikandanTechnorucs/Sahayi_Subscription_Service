import { logger } from '../../libs/logger/src/logger';
import type { RazorpayClient } from '../clients/razorpay.client';
import { BadRequestError, UnauthorizedError } from '../errors/app-error';
import type { UserSubscriptionRepository } from '../repositories/user-subscription.repository';
import type { WebhookEventRepository } from '../repositories/webhook-event.repository';
import type { UserSubscriptionService } from './user-subscription.service';
import type { UserSubscriptionStatus } from '../types/user-subscription.types';

const SUPPORTED_EVENTS = new Set([
  'subscription.authenticated',
  'subscription.activated',
  'subscription.charged',
  'subscription.pending',
  'subscription.halted',
  'subscription.paused',
  'subscription.resumed',
  'subscription.cancelled',
  'subscription.completed',
]);

const STATUS_RANK: Record<UserSubscriptionStatus, number> = {
  created: 1,
  authenticated: 2,
  pending: 3,
  active: 4,
  paused: 4,
  halted: 4,
  cancelled: 5,
  completed: 5,
  expired: 5,
};

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    subscription?: {
      entity?: Record<string, unknown>;
    };
    payment?: {
      entity?: Record<string, unknown>;
    };
  };
};

/**
 * Processes Razorpay subscription webhooks (signature + idempotency + status updates).
 */
export class RazorpayWebhookService {
  readonly #razorpayClient: RazorpayClient;
  readonly #webhookEventRepository: WebhookEventRepository;
  readonly #userSubscriptionRepository: UserSubscriptionRepository;
  readonly #userSubscriptionService: UserSubscriptionService;

  constructor(
    razorpayClient: RazorpayClient,
    webhookEventRepository: WebhookEventRepository,
    userSubscriptionRepository: UserSubscriptionRepository,
    userSubscriptionService: UserSubscriptionService,
  ) {
    this.#razorpayClient = razorpayClient;
    this.#webhookEventRepository = webhookEventRepository;
    this.#userSubscriptionRepository = userSubscriptionRepository;
    this.#userSubscriptionService = userSubscriptionService;
  }

  async handleWebhook(input: {
    rawBody: string;
    signature: string | undefined;
    eventId: string | undefined;
  }): Promise<{ duplicate: boolean; ignored: boolean }> {
    if (!input.signature) {
      throw new UnauthorizedError('Missing Razorpay signature');
    }

    if (!input.eventId) {
      throw new BadRequestError('Missing Razorpay event id');
    }

    const valid = this.#razorpayClient.verifyWebhookSignature(input.rawBody, input.signature);

    if (!valid) {
      throw new UnauthorizedError('Invalid Razorpay webhook signature');
    }

    let parsed: RazorpayWebhookPayload;

    try {
      parsed = JSON.parse(input.rawBody) as RazorpayWebhookPayload;
    } catch {
      throw new BadRequestError('Invalid webhook JSON body');
    }

    const eventType = parsed.event ?? 'unknown';
    const subscriptionEntity = parsed.payload?.subscription?.entity;
    const razorpaySubscriptionId = subscriptionEntity?.id
      ? String(subscriptionEntity.id)
      : null;

    logger.info(
      {
        service: 'subscription-service',
        eventId: input.eventId,
        eventType,
        razorpaySubscriptionId,
      },
      'razorpay webhook received',
    );

    const created = await this.#webhookEventRepository.tryCreate({
      eventId: input.eventId,
      eventType,
      razorpaySubscriptionId,
      processingStatus: SUPPORTED_EVENTS.has(eventType) ? 'processed' : 'ignored',
    });

    if (!created) {
      return { duplicate: true, ignored: false };
    }

    if (!SUPPORTED_EVENTS.has(eventType)) {
      return { duplicate: false, ignored: true };
    }

    if (!razorpaySubscriptionId || !subscriptionEntity) {
      await this.#webhookEventRepository.markFailed(
        input.eventId,
        'Missing subscription entity in webhook payload',
      );
      throw new BadRequestError('Missing subscription entity in webhook payload');
    }

    try {
      await this.#applySubscriptionEvent(eventType, subscriptionEntity, parsed.payload?.payment?.entity);
      return { duplicate: false, ignored: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'webhook processing failed';
      await this.#webhookEventRepository.markFailed(input.eventId, message);
      throw error;
    }
  }

  async #applySubscriptionEvent(
    eventType: string,
    subscriptionEntity: Record<string, unknown>,
    paymentEntity?: Record<string, unknown>,
  ): Promise<void> {
    const razorpaySubscriptionId = String(subscriptionEntity.id);
    const local = await this.#userSubscriptionRepository.findByRazorpaySubscriptionId(
      razorpaySubscriptionId,
    );

    if (!local) {
      logger.warn(
        {
          service: 'subscription-service',
          razorpaySubscriptionId,
          eventType,
        },
        'webhook for unknown local subscription',
      );
      return;
    }

    const incomingStatus = this.#statusFromEvent(eventType, subscriptionEntity);
    const nextStatus = this.#chooseStatus(local.status, incomingStatus);

    if (paymentEntity?.id) {
      await this.#userSubscriptionRepository.upsertPayment({
        userSubscriptionId: BigInt(local.id),
        razorpayPaymentId: String(paymentEntity.id),
        amount: typeof paymentEntity.amount === 'number' ? paymentEntity.amount : null,
        currency: paymentEntity.currency ? String(paymentEntity.currency) : null,
        status: paymentEntity.status ? String(paymentEntity.status) : eventType,
        paidAt:
          typeof paymentEntity.created_at === 'number'
            ? new Date(paymentEntity.created_at * 1000)
            : new Date(),
      });
    }

    await this.#userSubscriptionRepository.update(BigInt(local.id), {
      status: nextStatus,
      razorpayCustomerId: subscriptionEntity.customer_id
        ? String(subscriptionEntity.customer_id)
        : local.razorpayCustomerId,
      paidCount:
        typeof subscriptionEntity.paid_count === 'number'
          ? subscriptionEntity.paid_count
          : local.paidCount,
      remainingCount:
        subscriptionEntity.remaining_count === null ||
        subscriptionEntity.remaining_count === undefined
          ? local.remainingCount
          : Number(subscriptionEntity.remaining_count),
      currentStart: this.#unixToDate(subscriptionEntity.current_start),
      currentEnd: this.#unixToDate(subscriptionEntity.current_end),
      chargeAt: this.#unixToDate(subscriptionEntity.charge_at),
      cancelledAt:
        nextStatus === 'cancelled' || nextStatus === 'completed' || nextStatus === 'expired'
          ? local.cancelledAt ?? new Date()
          : local.cancelledAt,
      pausedAt: nextStatus === 'paused' ? local.pausedAt ?? new Date() : null,
      endedAt:
        nextStatus === 'cancelled' || nextStatus === 'completed' || nextStatus === 'expired'
          ? local.endedAt ?? this.#unixToDate(subscriptionEntity.ended_at) ?? new Date()
          : local.endedAt,
      history: {
        eventSource: 'webhook',
        eventType,
      },
    });

    if (nextStatus === 'authenticated' || nextStatus === 'active') {
      const granted = await this.#userSubscriptionRepository.findByRazorpaySubscriptionId(
        razorpaySubscriptionId,
      );

      if (granted) {
        await this.#userSubscriptionService.activateEntitlements(granted);
      }
    }
  }

  #statusFromEvent(eventType: string, entity: Record<string, unknown>): UserSubscriptionStatus {
    switch (eventType) {
      case 'subscription.authenticated':
        return 'authenticated';
      case 'subscription.activated':
      case 'subscription.charged':
      case 'subscription.resumed':
        return 'active';
      case 'subscription.pending':
        return 'pending';
      case 'subscription.halted':
        return 'halted';
      case 'subscription.paused':
        return 'paused';
      case 'subscription.cancelled':
        return 'cancelled';
      case 'subscription.completed':
        return 'completed';
      default: {
        const raw = String(entity.status ?? 'pending').toLowerCase();
        return (STATUS_RANK[raw as UserSubscriptionStatus] !== undefined
          ? raw
          : 'pending') as UserSubscriptionStatus;
      }
    }
  }

  /**
   * Prevents out-of-order webhooks from downgrading terminal/lifecycle state incorrectly.
   */
  #chooseStatus(
    current: UserSubscriptionStatus,
    incoming: UserSubscriptionStatus,
  ): UserSubscriptionStatus {
    if (current === 'cancelled' || current === 'completed' || current === 'expired') {
      return current;
    }

    if (STATUS_RANK[incoming] >= STATUS_RANK[current]) {
      return incoming;
    }

    // Allow pause/halt from active even if ranks equal-ish handled above
    if (
      (incoming === 'paused' || incoming === 'halted' || incoming === 'pending') &&
      (current === 'active' || current === 'authenticated')
    ) {
      return incoming;
    }

    return current;
  }

  #unixToDate(value: unknown): Date | null {
    if (typeof value !== 'number') {
      return null;
    }

    return new Date(value * 1000);
  }
}
