import { randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { ZodType, ZodError } from 'zod';
import sanitizeHtml from 'sanitize-html';
import type { JwtPayload } from '../types/index.js';

export * from './blacklist.js';
export * from './auth.js';
export * from './validateSecret.js';
export * from './tokenHash.js';
export * from './validateEnv.js'

// Declared here because the shared package compiles independently
// from the services. It doesn't see their express.d.ts augmentations,
// so we need to extend the Request type within the shared scope.
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: JwtPayload;
    }
  }
}

/**
 * Reads X-Request-Id from the gateway (or generates one) and:
 * 1. Attaches it to req.requestId for use in logs and inter-service calls
 * 2. Sends it back in the response header so the client can reference it
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string) || randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

/**
 * Validates req.body against a Zod schema.
 * Returns 400 with field-level errors if validation fails.
 * Replaces req.body with the parsed (clean) data if validation passes.
 */
export function validate(schema: ZodType, target: 'body' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (target === 'params') {
        req.params = schema.parse(req.params) as Record<string, string>;
      } else {
        req.body = schema.parse(req.body);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        res.status(400).json({ success: false, errors });
        return;
      }
      next(err);
    }
  };
}

/**
 * Recursively sanitizes all string values in an object.
 * Strips any HTML tags to prevent XSS attacks.
 */
function sanitizeValue(value: unknown): unknown {
  // Plain text passes through unchanged.
  if (typeof value === 'string') {
    return sanitizeHtml(value, {
      allowedTags: [],
      allowedAttributes: {},
    });
  }

  // req.body might look like { tags: ["<script>...", "normal"] }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  // If it's an object (and not null — because typeof null === 'object')
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = sanitizeValue(val);
    }
    return result;
  }

  return value;
}

export function sanitizeBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  next();
}

export function issueCsrfToken(res: Response, options: { secure: boolean }): string {
  const token = randomBytes(32).toString('hex');
  res.cookie('csrfToken', token, { 
    httpOnly: false,
    secure: options.secure,
    sameSite: 'lax',
    maxAge: 2 * 60 * 60 * 1000, //2 hours
    path: '/',
  });
  return token;
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // 1. Safe methods skip entirely — they should have no side effects
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // 2. Pull the expected value from req.cookies.csrfToken
  const expectedToken = req.cookies?.csrfToken as string | undefined;

  // 3. Pull the submitted value from req.headers['x-csrf-token']
  const submittedToken = req.headers['x-csrf-token'] as string | undefined;

  // 4. Any missing → 403
  if (!expectedToken || !submittedToken || expectedToken.length !== submittedToken.length) {
    res.status(403).json({ success: false, message: 'CSRF validation failed' });
    return;
  }

  // 5. Constant-time comparison
  if (!timingSafeEqual(Buffer.from(expectedToken), Buffer.from(submittedToken))) {
    res.status(403).json({ success: false, message: 'CSRF validation failed' });
    return;
  }

  next();
}