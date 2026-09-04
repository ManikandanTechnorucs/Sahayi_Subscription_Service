import { config } from '../../libs/config/src/config';
import { logger } from '../../libs/logger/src/logger';
import { ServiceUnavailableError } from '../errors/app-error';

/**
 * Reads and updates users.SubscriptionId in User Service.
 */
export class UserEntitlementClient {
  async getSubscriptionId(userId: string): Promise<number | null> {
    const { token, url } = this.#entitlementRequest(userId);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-internal-service-token': token,
        },
      });

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
        data?: { subscriptionId?: number | null };
      } | null;

      if (!response.ok || payload?.success === false) {
        const error = payload?.message ?? `HTTP ${response.status}`;
        logger.warn(
          {
            service: 'subscription-service',
            userId,
            url,
            status: response.status,
            error,
          },
          'user entitlement lookup failed',
        );
        throw new ServiceUnavailableError(`Failed to read user subscription entitlement: ${error}`);
      }

      const subscriptionId = payload?.data?.subscriptionId;
      return typeof subscriptionId === 'number' ? subscriptionId : null;
    } catch (error) {
      if (error instanceof ServiceUnavailableError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'entitlement lookup request failed';
      logger.warn(
        {
          service: 'subscription-service',
          userId,
          err: message,
        },
        'user entitlement lookup error',
      );
      throw new ServiceUnavailableError(`Failed to read user subscription entitlement: ${message}`);
    }
  }

  async setSubscriptionId(userId: string, subscriptionId: number): Promise<void> {
    const { token, url } = this.#entitlementRequest(userId);

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service-token': token,
        },
        body: JSON.stringify({ subscriptionId }),
      });

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
      } | null;

      if (!response.ok || payload?.success === false) {
        const error = payload?.message ?? `HTTP ${response.status}`;
        logger.warn(
          {
            service: 'subscription-service',
            userId,
            subscriptionId,
            url,
            status: response.status,
            error,
          },
          'user entitlement sync failed',
        );
        throw new ServiceUnavailableError(`Failed to update user subscription entitlement: ${error}`);
      }

      logger.info(
        {
          service: 'subscription-service',
          userId,
          subscriptionId,
        },
        'user entitlement synced',
      );
    } catch (error) {
      if (error instanceof ServiceUnavailableError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'entitlement sync request failed';
      logger.warn(
        {
          service: 'subscription-service',
          userId,
          subscriptionId,
          err: message,
        },
        'user entitlement sync error',
      );
      throw new ServiceUnavailableError(`Failed to update user subscription entitlement: ${message}`);
    }
  }

  #entitlementRequest(userId: string): { token: string; url: string } {
    const baseUrl = config.USER_SERVICE_BASE_URL.trim();
    const token = config.INTERNAL_SERVICE_TOKEN.trim();

    if (!baseUrl || !token) {
      throw new ServiceUnavailableError('User entitlement sync is not configured');
    }

    return {
      token,
      url: `${baseUrl.replace(/\/$/, '')}/internal/users/${encodeURIComponent(userId)}/subscription`,
    };
  }
}
