import type { NextFunction, Response } from 'express';
import { Prisma } from '../../generated/prisma/client';
import { logger } from '../../libs/logger/src/logger';
import { response } from '../../libs/response/src/response';
import { SERVICE_NAME } from '../constants/service.constants';
import { AppError } from '../errors/app-error';
import { recordFailedApiRequest } from '../telemetry/record-failed-api-request';
import type { RequestWithTelemetry } from './request-logger';

type RequestError = Error & {
  statusCode?: number;
  code?: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
};

function trackFailedRequest(
  req: RequestWithTelemetry,
  statusCode: number,
  errorMessage: string,
  err: RequestError,
): void {
  recordFailedApiRequest({
    serviceName: SERVICE_NAME,
    endpoint: req.originalUrl || req.url || 'unknown',
    method: req.method,
    statusCode,
    errorMessage,
    occurredAt: new Date().toISOString(),
    error: err,
    ...(err.name ? { errorName: err.name } : {}),
    ...(typeof req.startedAt === 'number' ? { durationMs: Date.now() - req.startedAt } : {}),
    ...(req.requestId ? { correlationId: req.requestId } : {}),
  });
}

export function errorHandler(
  err: RequestError,
  req: RequestWithTelemetry,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const statusCode = 409;
      const message = 'Duplicate record';
      trackFailedRequest(req, statusCode, message, err);
      res.status(statusCode).json(response.createError(message, 'DUPLICATE_RECORD'));
      return;
    }

    if (err.code === 'P2025') {
      const statusCode = 404;
      trackFailedRequest(req, statusCode, response.NO_DATA_FOUND_V2.message, err);
      res.status(statusCode).json(response.NO_DATA_FOUND_V2);
      return;
    }
  }

  if (err.name === 'DriverAdapterError' || err.message.includes('pool timeout')) {
    const statusCode = 503;
    const message = 'Database is temporarily unavailable. Please try again later.';
    logger.error({ err, service: SERVICE_NAME }, 'database connection failure');
    trackFailedRequest(req, statusCode, message, err);
    res.status(statusCode).json(response.createError(message, 'DATABASE_UNAVAILABLE'));
    return;
  }

  const statusCode = err.statusCode ?? 500;
  const message =
    statusCode >= 500 && !(err instanceof AppError)
      ? 'Something went wrong. Please try again later'
      : err.message;

  if (statusCode === 400 && err.code === 'VALIDATION_ERROR') {
    logger.warn(
      {
        service: SERVICE_NAME,
        code: err.code,
        errors: err.errors,
      },
      'validation failed',
    );
  } else if (statusCode === 401 || statusCode === 403) {
    logger.warn(
      {
        service: SERVICE_NAME,
        statusCode,
        code: err.code,
      },
      'authentication or authorization failed',
    );
  } else if (statusCode >= 500) {
    logger.error({ err, service: SERVICE_NAME }, 'unhandled request error');
  } else if (err instanceof AppError) {
    logger.warn(
      {
        service: SERVICE_NAME,
        statusCode,
        code: err.code,
        message: err.message,
      },
      'request failed',
    );
  }

  if (statusCode === 401) {
    trackFailedRequest(req, statusCode, response.UNAUTHORIZED.message, err);
    res.status(401).json(response.UNAUTHORIZED);
    return;
  }

  if (statusCode === 403) {
    trackFailedRequest(req, statusCode, response.PERMISSION_DENIED.message, err);
    res.status(403).json(response.PERMISSION_DENIED);
    return;
  }

  trackFailedRequest(req, statusCode, message, err);
  res.status(statusCode).json(response.createError(message, err.code, err.errors));
}
