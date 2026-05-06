import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../logger/index.js';

export function createRequestLogger(service: string) {
  const logger = createLogger(service);

  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;

      logger.info({
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration,
        requestId: req.requestId,
        userId: req.user?.id,
      }, 'HTTP request');
    });

    next();
  };
}
