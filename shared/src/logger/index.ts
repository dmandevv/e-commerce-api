import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export function createLogger(service: string) {
  return pino({
    level: process.env.LOG_LEVEL || 'info',
    base: { service },
    transport: isDev
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  });
}

export type Logger = ReturnType<typeof createLogger>;
