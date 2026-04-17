import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { ZodType, ZodError } from 'zod';
import sanitizeHtml from 'sanitize-html';

// Declared here because the shared package compiles independently
// from the services. It doesn't see their express.d.ts augmentations,
// so we need to extend the Request type within the shared scope.
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
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
export function validate(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
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