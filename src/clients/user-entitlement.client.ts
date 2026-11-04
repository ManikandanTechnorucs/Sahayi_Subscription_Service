import http from 'node:http';
import https from 'node:https';
import { config } from '../../libs/config/src/config';
import { logger } from '../../libs/logger/src/logger';
import { ServiceUnavailableError } from '../errors/app-error';

const ENTITLEMENT_TIMEOUT_MS = 8_000;
const ENTITLEMENT_ATTEMPTS = 3;

type EntitlementPayload = {
  success?: boolean;
  message?: string;
  data?: { subscriptionId?: number | null };
};

type JsonResponse = {
  status: number;
  payload: EntitlementPayload | null;
};

/**
 * Reads and updates users.SubscriptionId in User Service.
 */
export class UserEntitlementClient {
  async getSubscriptionId(userId: string): Promise<number | null> {
    const { token, url } = this.#entitlementRequest(userId);
    const response = await this.#requestWithRetry({
      url,
      method: 'GET',
      token,
      userId,
      action: 'lookup',
    });

    this.#assertOk(response, userId, url, 'Failed to read user subscription entitlement');

    const subscriptionId = response.payload?.data?.subscriptionId;
    return typeof subscriptionId === 'number' ? subscriptionId : null;
  }

  async setSubscriptionId(userId: string, subscriptionId: number): Promise<void> {
    const { token, url } = this.#entitlementRequest(userId);
    const response = await this.#requestWithRetry({
      url,
      method: 'PUT',
      token,
      userId,
      action: 'sync',
      body: { subscriptionId },
    });

    this.#assertOk(response, userId, url, 'Failed to update user subscription entitlement');

    logger.info(
      {
        service: 'subscription-service',
        userId,
        subscriptionId,
      },
      'user entitlement synced',
    );
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

  async #requestWithRetry(input: {
    url: string;
    method: 'GET' | 'PUT';
    token: string;
    userId: string;
    action: 'lookup' | 'sync';
    body?: unknown;
  }): Promise<JsonResponse> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= ENTITLEMENT_ATTEMPTS; attempt += 1) {
      try {
        return await this.#requestJson(input);
      } catch (error) {
        lastError = error;
        const message = describeNetworkError(error);
        logger.warn(
          {
            service: 'subscription-service',
            userId: input.userId,
            url: input.url,
            action: input.action,
            attempt,
            err: message,
          },
          'user entitlement request failed',
        );

        if (attempt < ENTITLEMENT_ATTEMPTS) {
          await sleep(250 * attempt);
        }
      }
    }

    throw new ServiceUnavailableError(
      `Failed to ${input.action === 'sync' ? 'update' : 'read'} user subscription entitlement: ${describeNetworkError(lastError)}`,
    );
  }

  #requestJson(input: {
    url: string;
    method: 'GET' | 'PUT';
    token: string;
    body?: unknown;
  }): Promise<JsonResponse> {
    const target = new URL(input.url);
    const isHttps = target.protocol === 'https:';
    const lib = isHttps ? https : http;
    const encoded = input.body === undefined ? undefined : JSON.stringify(input.body);

    return new Promise((resolve, reject) => {
      const req = lib.request(
        {
          protocol: target.protocol,
          hostname: target.hostname,
          port: target.port || (isHttps ? 443 : 80),
          path: `${target.pathname}${target.search}`,
          method: input.method,
          family: 4,
          timeout: ENTITLEMENT_TIMEOUT_MS,
          headers: {
            Accept: 'application/json',
            'x-internal-service-token': input.token,
            ...(encoded
              ? {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(encoded),
                }
              : {}),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];

          res.on('data', (chunk: Buffer | string) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });

          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            let payload: EntitlementPayload | null = null;

            if (raw) {
              try {
                payload = JSON.parse(raw) as EntitlementPayload;
              } catch {
                payload = null;
              }
            }

            resolve({
              status: res.statusCode ?? 0,
              payload,
            });
          });
        },
      );

      req.on('timeout', () => {
        req.destroy(
          new Error(`User Service entitlement request timed out after ${ENTITLEMENT_TIMEOUT_MS}ms`),
        );
      });
      req.on('error', reject);

      if (encoded) {
        req.write(encoded);
      }

      req.end();
    });
  }

  #assertOk(
    response: JsonResponse,
    userId: string,
    url: string,
    prefix: string,
  ): void {
    if (response.status >= 200 && response.status < 300 && response.payload?.success !== false) {
      return;
    }

    const error = response.payload?.message ?? `HTTP ${response.status}`;
    logger.warn(
      {
        service: 'subscription-service',
        userId,
        url,
        status: response.status,
        error,
      },
      'user entitlement response failed',
    );
    throw new ServiceUnavailableError(`${prefix}: ${error}`);
  }
}

function describeNetworkError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'entitlement request failed';
  }

  const parts = [error.message];
  const cause = (error as Error & { cause?: unknown }).cause;

  if (cause instanceof Error && cause.message && cause.message !== error.message) {
    parts.push(cause.message);
  } else if (cause && typeof cause === 'object' && 'code' in cause) {
    const coded = cause as { code?: string; message?: string };
    parts.push(coded.code ?? coded.message ?? 'unknown cause');
  }

  const code = (error as Error & { code?: string }).code;
  if (code && !parts.join(' ').includes(code)) {
    parts.push(code);
  }

  return parts.filter(Boolean).join(': ');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
