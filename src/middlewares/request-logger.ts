import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '../../libs/logger/src/logger';

type RequestWithLogger = Request & {
  requestId?: string;
  log?: ReturnType<typeof logger.child>;
};

/**
 * Adds request-scoped logging metadata and emits a completion log.
 */
export function requestLogger(req: RequestWithLogger, res: Response, next: NextFunction): void {
  const requestIdHeader = req.headers['x-request-id'];
  const requestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader;

  req.requestId = requestId ?? randomUUID();
  req.log = logger.child({
    requestId: req.requestId,
    service: 'subscription-service',
  });

  const startedAt = Date.now();
  res.on('finish', () => {
    req.log?.info(
      {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      },
      'request completed',
    );
  });

  next();
}
