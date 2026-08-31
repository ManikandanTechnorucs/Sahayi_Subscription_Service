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

const isRunningInDocker = (): boolean => existsSync('/.dockerenv');

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

/**
 * Shared runtime configuration loaded from environment variables.
 */
export const config = {
  IS_DEVELOPMENT: (process.env.NODE_ENV ?? 'development') !== 'production',
  DATABASE_URL: normalizeDatabaseUrl(getRequiredEnv('DATABASE_URL')),
  JWT_SECRET: process.env.JWT_SECRET || 'asdkjhkjkkkh987879879879987khkas',
  SUBSCRIPTION_SERVICE_PORT: Number(process.env.SUBSCRIPTION_SERVICE_PORT ?? 3007),
  RAZORPAY_KEY_ID: getOptionalEnv('RAZORPAY_KEY_ID') ?? '',
  RAZORPAY_KEY_SECRET: getOptionalEnv('RAZORPAY_KEY_SECRET') ?? '',
  RAZORPAY_WEBHOOK_SECRET: getOptionalEnv('RAZORPAY_WEBHOOK_SECRET') ?? '',
  RAZORPAY_CURRENCY: getOptionalEnv('RAZORPAY_CURRENCY') ?? 'INR',
  RAZORPAY_DEFAULT_TOTAL_COUNT: Number(getOptionalEnv('RAZORPAY_DEFAULT_TOTAL_COUNT') ?? 12),
  CHECKOUT_DISPLAY_NAME: getOptionalEnv('CHECKOUT_DISPLAY_NAME') ?? 'Sahayi',
};
