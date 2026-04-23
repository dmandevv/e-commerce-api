/**
 * Shared auth middleware factory.
 *
 * Each service constructs its own `authenticate` by passing in:
 *   - jwtSecret (from service config)
 *   - blacklist (optional — services that don't need revocation can skip it)
 *
 * Centralizing this means:
 *   - One implementation of JWT verification logic (no drift across services)
 *   - Uniform error messages
 *   - Uniform blacklist check behavior
 */

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError } from '../errors/index.js';
import type { JwtPayload } from '../types/index.js';

export interface AuthOptions {
  jwtSecret: string;
  blacklist?: { isBlacklisted(jti: string): Promise<boolean> };
}

export function createAuthenticate(options: AuthOptions) {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    // 1. httpOnly accessToken cookie (browser clients)
    const cookieToken = req.cookies?.accessToken;

    // 2. Bearer header fallback (service-to-service, tests, curl)
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : undefined;

    const token = cookieToken || bearerToken;
    if (!token) {
      throw new UnauthorizedError('Login first to access this resource');
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, options.jwtSecret) as JwtPayload;
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }

    // Blacklist check — skipped if service wasn't given one, or token has no jti.
    // Helper fails-open on Redis errors, so an outage won't break auth.
    if (
      options.blacklist &&
      decoded.jti &&
      (await options.blacklist.isBlacklisted(decoded.jti))
    ) {
      throw new UnauthorizedError('Token has been revoked');
    }

    req.user = decoded;
    next();
  };
}

export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ForbiddenError(
        `Role (${req.user?.role}) is not allowed to access this resource`
      );
    }
    next();
  };
}
