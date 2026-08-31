import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client';
import { logger } from '../../libs/logger/src/logger';
import { response } from '../../libs/response/src/response';
import { AppError } from '../errors/app-error';

export function errorHandler(
  err: Error & {
    statusCode?: number;
    code?: string;
    errors?: Array<{
      field: string;
      message: string;
    }>;
  },
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json(response.createError('Duplicate record', 'DUPLICATE_RECORD'));
      return;
    }

    if (err.code === 'P2025') {
      res.status(404).json(response.NO_DATA_FOUND_V2);
      return;
    }
  }

  if (err.name === 'DriverAdapterError' || err.message.includes('pool timeout')) {
    logger.error({ err, service: 'subscription-service' }, 'database connection failure');
    res.status(503).json(
      response.createError(
        'Database is temporarily unavailable. Please try again later.',
        'DATABASE_UNAVAILABLE',
      ),
    );
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
        service: 'subscription-service',
        code: err.code,
        errors: err.errors,
      },
      'validation failed',
    );
  } else if (statusCode === 401 || statusCode === 403) {
    logger.warn(
      {
        service: 'subscription-service',
        statusCode,
        code: err.code,
      },
      'authentication or authorization failed',
    );
  } else if (statusCode >= 500) {
    logger.error({ err, service: 'subscription-service' }, 'unhandled request error');
  } else if (err instanceof AppError) {
    logger.warn(
      {
        service: 'subscription-service',
        statusCode,
        code: err.code,
        message: err.message,
      },
      'request failed',
    );
  }

  if (statusCode === 401) {
    res.status(401).json(response.UNAUTHORIZED);
    return;
  }

  if (statusCode === 403) {
    res.status(403).json(response.PERMISSION_DENIED);
    return;
  }

  res.status(statusCode).json(response.createError(message, err.code, err.errors));
}
