import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../../libs/config/src/config';
import { ServiceUnavailableError, UnauthorizedError } from '../errors/app-error';

/**
 * Authenticates internal service-to-service calls.
 */
export const requireInternalServiceToken = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const configured = config.INTERNAL_SERVICE_TOKEN.trim();

  if (!configured) {
    next(new ServiceUnavailableError('Internal service token is not configured'));
    return;
  }

  const header = req.headers['x-internal-service-token'];
  const provided = Array.isArray(header) ? header[0] : header;

  if (!provided || !isTokenMatch(configured, provided)) {
    next(new UnauthorizedError('Invalid internal service token'));
    return;
  }

  next();
};

function isTokenMatch(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}
