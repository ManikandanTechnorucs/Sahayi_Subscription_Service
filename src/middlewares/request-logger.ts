import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '../../libs/logger/src/logger';

export type RequestWithTelemetry = Request & {
  requestId?: string;
  startedAt?: number;
  log?: ReturnType<typeof logger.child>;
};

/**
 * Adds request-scoped logging metadata and emits a completion log.
 */
export function requestLogger(req: RequestWithTelemetry, res: Response, next: NextFunction): void {
  const requestIdHeader = req.headers['x-request-id'];
  const requestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader;

  req.requestId = requestId ?? randomUUID();
  req.startedAt = Date.now();
  req.log = logger.child({
    requestId: req.requestId,
    service: 'subscription-service',
  });

  res.on('finish', () => {
    req.log?.info(
      {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - (req.startedAt ?? Date.now()),
      },
      'request completed',
    );
  });

  next();
}
