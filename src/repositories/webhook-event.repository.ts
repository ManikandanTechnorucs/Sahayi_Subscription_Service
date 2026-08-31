import type { PrismaClient, WebhookProcessingStatus } from '../../generated/prisma/client';

export type WebhookEventRecord = {
  id: string;
  eventId: string;
  eventType: string;
  razorpaySubscriptionId: string | null;
  processingStatus: WebhookProcessingStatus;
  errorMessage: string | null;
  processedAt: Date;
};

/**
 * Repository for webhook idempotency and audit rows.
 */
export class WebhookEventRepository {
  readonly #prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.#prisma = prisma;
  }

  async findByEventId(eventId: string): Promise<WebhookEventRecord | null> {
    const row = await this.#prisma.webhookEvent.findUnique({
      where: { EventId: eventId },
    });

    return row
      ? {
          id: row.Id.toString(),
          eventId: row.EventId,
          eventType: row.EventType,
          razorpaySubscriptionId: row.RazorpaySubscriptionId,
          processingStatus: row.ProcessingStatus,
          errorMessage: row.ErrorMessage,
          processedAt: row.ProcessedAt,
        }
      : null;
  }

  /**
   * Inserts an event row. Returns null if the event id already exists (duplicate).
   */
  async tryCreate(input: {
    eventId: string;
    eventType: string;
    razorpaySubscriptionId?: string | null;
    processingStatus?: WebhookProcessingStatus;
    errorMessage?: string | null;
  }): Promise<WebhookEventRecord | null> {
    try {
      const row = await this.#prisma.webhookEvent.create({
        data: {
          EventId: input.eventId,
          EventType: input.eventType,
          RazorpaySubscriptionId: input.razorpaySubscriptionId ?? null,
          ProcessingStatus: input.processingStatus ?? 'processed',
          ErrorMessage: input.errorMessage ?? null,
        },
      });

      return {
        id: row.Id.toString(),
        eventId: row.EventId,
        eventType: row.EventType,
        razorpaySubscriptionId: row.RazorpaySubscriptionId,
        processingStatus: row.ProcessingStatus,
        errorMessage: row.ErrorMessage,
        processedAt: row.ProcessedAt,
      };
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        return null;
      }

      throw error;
    }
  }

  async markFailed(eventId: string, errorMessage: string): Promise<void> {
    await this.#prisma.webhookEvent.update({
      where: { EventId: eventId },
      data: {
        ProcessingStatus: 'failed',
        ErrorMessage: errorMessage.slice(0, 500),
      },
    });
  }
}
