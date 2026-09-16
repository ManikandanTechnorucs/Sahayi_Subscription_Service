import dotenv from 'dotenv';
import { existsSync } from 'node:fs';

dotenv.config();

const stripWrappingQuotes = (value: string): string => {
  const trimmed = value.trim();
  const isDoubleQuoted = trimmed.startsWith('"') && trimmed.endsWith('"');
  const isSingleQuoted = trimmed.startsWith("'") && trimmed.endsWith("'");

  return isDoubleQuoted || isSingleQuoted ? trimmed.slice(1, -1) : trimmed;
};

/**
 * Reads a required environment variable.
 */
const getRequiredEnv = (key: string): string => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return stripWrappingQuotes(value);
};

/**
 * Reads an optional environment variable.
 */
const getOptionalEnv = (key: string): string | undefined => {
  const value = process.env[key];

  if (!value) {
    return undefined;
  }

  return stripWrappingQuotes(value);
};

const parseBooleanEnv = (key: string, fallback: boolean): boolean => {
  const value = getOptionalEnv(key);

  if (value === undefined) {
    return fallback;
  }

  const normalized = value.toLowerCase();

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
};

const isRunningInDocker = (): boolean => existsSync('/.dockerenv');

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isDevelopment = nodeEnv !== 'production';

const PRODUCTION_USER_SERVICE_BASE_URL = 'https://user.sahayii.com';
const PRODUCTION_SUBSCRIPTION_SERVICE_PUBLIC_URL = 'https://subscription.sahayii.com';

const normalizeDatabaseUrl = (databaseUrl: string): string => {
  if (!isRunningInDocker()) {
    return databaseUrl;
  }

  const url = new URL(databaseUrl);

  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    url.hostname = 'host.docker.internal';
  }

  return url.toString();
};

const isLoopbackHostname = (hostname: string): boolean =>
  hostname === 'localhost' || hostname === '127.0.0.1';

/**
 * Loopback User Service URLs work on a local process, but fail in Docker and
 * on production hosts. Rewrite those to the reachable origin.
 */
const normalizeInternalServiceUrl = (serviceUrl: string, productionUrl: string): string => {
  let parsed: URL;

  try {
    parsed = new URL(serviceUrl);
  } catch {
    return serviceUrl;
  }

  if (!isLoopbackHostname(parsed.hostname)) {
    return serviceUrl;
  }

  if (!isDevelopment) {
    return productionUrl;
  }

  if (isRunningInDocker()) {
    parsed.hostname = 'host.docker.internal';
    return parsed.toString();
  }

  return serviceUrl;
};

/**
 * Shared runtime configuration loaded from environment variables.
 */
export const config = {
  IS_DEVELOPMENT: isDevelopment,
  DATABASE_URL: normalizeDatabaseUrl(getRequiredEnv('DATABASE_URL')),
  JWT_SECRET: `"${getRequiredEnv('JWT_SECRET')}"`,
  SUBSCRIPTION_SERVICE_PORT: Number(process.env.SUBSCRIPTION_SERVICE_PORT ?? 3012),
  SUBSCRIPTION_SERVICE_PUBLIC_URL:
    getOptionalEnv('SUBSCRIPTION_SERVICE_PUBLIC_URL') ?? PRODUCTION_SUBSCRIPTION_SERVICE_PUBLIC_URL,
  RAZORPAY_KEY_ID: getOptionalEnv('RAZORPAY_KEY_ID') ?? '',
  RAZORPAY_KEY_SECRET: getOptionalEnv('RAZORPAY_KEY_SECRET') ?? '',
  RAZORPAY_WEBHOOK_SECRET: getOptionalEnv('RAZORPAY_WEBHOOK_SECRET') ?? '',
  RAZORPAY_CURRENCY: getOptionalEnv('RAZORPAY_CURRENCY') ?? 'INR',
  RAZORPAY_DEFAULT_TOTAL_COUNT: Number(getOptionalEnv('RAZORPAY_DEFAULT_TOTAL_COUNT') ?? 12),
  /**
   * Razorpay rejects start_at timestamps closer than this. Period-end changes
   * still schedule (never forfeit now) and use now + offset when CurrentEnd is sooner.
   */
  RAZORPAY_MIN_START_AT_OFFSET_SEC: Number(getOptionalEnv('RAZORPAY_MIN_START_AT_OFFSET_SEC') ?? 15 * 60),
  /**
   * When true, create missing Razorpay catalog plans on process start using this
   * environment's key_id / key_secret (UAT test dashboard vs prod live dashboard).
   */
  RAZORPAY_SYNC_ON_STARTUP: parseBooleanEnv('RAZORPAY_SYNC_ON_STARTUP', true),
  /**
   * When true, create new Razorpay plans even if ids are already stored.
   * Use when switching this environment to a different Razorpay account.
   */
  RAZORPAY_SYNC_FORCE: parseBooleanEnv('RAZORPAY_SYNC_FORCE', false),
  CHECKOUT_DISPLAY_NAME: getOptionalEnv('CHECKOUT_DISPLAY_NAME') ?? 'Sahayi',
  USER_SERVICE_BASE_URL: normalizeInternalServiceUrl(
    getOptionalEnv('USER_SERVICE_BASE_URL') ??
      (isDevelopment ? 'http://localhost:3005' : PRODUCTION_USER_SERVICE_BASE_URL),
    PRODUCTION_USER_SERVICE_BASE_URL,
  ),
  INTERNAL_SERVICE_TOKEN: getRequiredEnv('INTERNAL_SERVICE_TOKEN'),
};
