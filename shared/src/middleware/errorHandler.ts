import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/index.js';
import { createLogger } from '../logger/index.js';

export function createErrorHandler(service: string) {
  const logger = createLogger(service);

  return (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }

    if (err.name === 'MongoServerError' && (err as any).code === 11000) {
      res.status(409).json({ success: false, message: 'Duplicate field value entered' });
      return;
    }

    if (err.name === 'ValidationError') {
      res.status(400).json({ success: false, message: err.message });
      return;
    }

    logger.error({ err }, 'Unexpected error');
    res.status(500).json({ success: false, message: 'Internal server error' });
  };
}
