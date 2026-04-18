import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { UnauthorizedError, ForbiddenError } from '@ecommerce/shared/errors';
import type { JwtPayload } from '@ecommerce/shared/types';

// ─── Authenticate ───────────────────────────────────────
export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  // 1. Try the httpOnly accessToken cookie (browser clients)
  const cookieToken = req.cookies?.accessToken;

  // 2. Fall back to Authorization: Bearer header (service-to-service, old clients)
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : undefined;

  const token = cookieToken || bearerToken;

  if (!token) {
    throw new UnauthorizedError('Login first to access this resource');
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
};

// ─── Authorize Roles ────────────────────────────────────
export const authorize = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ForbiddenError(
        `Role (${req.user?.role}) is not allowed to access this resource`
      );
    }
    next();
  };
};
