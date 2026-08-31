import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { JwtPayload } from 'jsonwebtoken';
import {
  type AuthTokenPayload,
  verifyToken,
} from '../../libs/auth/src/jwt';
import { UnauthorizedError } from '../errors/app-error';

export type AuthenticatedRequest = Request & {
  user: AuthTokenPayload;
};

const isAuthTokenPayload = (
  decoded: string | JwtPayload,
): decoded is AuthTokenPayload => {
  return (
    typeof decoded === 'object' &&
    decoded !== null &&
    'id' in decoded &&
    typeof decoded.id === 'string' &&
    'role' in decoded &&
    typeof decoded.role === 'string'
  );
};

const isAccessToken = (payload: AuthTokenPayload): boolean =>
  payload.purpose === undefined || payload.purpose === 'access';

/**
 * Verifies a bearer token and attaches the decoded user payload.
 */
export const authMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const auth = req.headers.authorization;

  if (!auth) {
    next(new UnauthorizedError('Missing authorization header'));
    return;
  }

  const token = auth.split(' ')[1];

  if (!token) {
    next(new UnauthorizedError('Invalid authorization header'));
    return;
  }

  try {
    const decoded = verifyToken(token);

    if (!isAuthTokenPayload(decoded)) {
      next(new UnauthorizedError('Invalid token payload'));
      return;
    }

    (req as AuthenticatedRequest).user = decoded;
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
};

/**
 * Rejects short-lived OTP verification tokens; requires a full access token.
 */
export const requireAccessToken = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const user = (req as AuthenticatedRequest).user;

  if (!isAccessToken(user)) {
    next(new UnauthorizedError('Invalid or expired token'));
    return;
  }

  next();
};

/**
 * Adapts a handler that requires an authenticated request for Express routing.
 */
export const asAuthenticatedHandler = (
  handler: (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => void | Promise<void>,
): RequestHandler => {
  return (req, res, next) => {
    void handler(req as AuthenticatedRequest, res, next);
  };
};
