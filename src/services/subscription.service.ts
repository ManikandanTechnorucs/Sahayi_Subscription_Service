import { BadRequestError, NotFoundError } from '../errors/app-error';
import type { SubscriptionRepository } from '../repositories/subscription.repository';
import type {
  CreateSubscriptionInput,
  SubscriptionPlan,
  UpdateSubscriptionInput,
} from '../types/subscription.types';

/**
 * Service responsible for subscription plan catalog business logic.
 */
export class SubscriptionService {
  readonly #subscriptionRepository: SubscriptionRepository;

  constructor(subscriptionRepository: SubscriptionRepository) {
    this.#subscriptionRepository = subscriptionRepository;
  }

  /**
   * Returns active subscription plans.
   */
  async listSubscriptions(): Promise<SubscriptionPlan[]> {
    return this.#subscriptionRepository.findActiveSubscriptions();
  }

  /**
   * Returns a subscription plan by id.
   */
  async getSubscription(id: string): Promise<SubscriptionPlan> {
    const parsedId = this.#parseId(id);
    const subscription = await this.#subscriptionRepository.findById(parsedId);

    if (!subscription) {
      throw new NotFoundError('Subscription');
    }

    return subscription;
  }

  /**
   * Creates a subscription plan.
   */
  async createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionPlan> {
    return this.#subscriptionRepository.create(input);
  }

  /**
   * Updates a subscription plan by id.
   */
  async updateSubscription(id: string, input: UpdateSubscriptionInput): Promise<SubscriptionPlan> {
    const hasUpdateField = Object.values(input).some((value) => value !== undefined);

    if (!hasUpdateField) {
      throw new BadRequestError('At least one field must be provided for update');
    }

    const parsedId = this.#parseId(id);
    const updated = await this.#subscriptionRepository.update(parsedId, input);

    if (!updated) {
      throw new NotFoundError('Subscription');
    }

    return updated;
  }

  #parseId(id: string): number {
    const parsed = Number(id);

    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new BadRequestError('Invalid subscription id');
    }

    return parsed;
  }
}
