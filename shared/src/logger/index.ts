import pino from 'pino';

export function createLogger(service: string) {
  return pino({
    level: process.env.LOG_LEVEL || 'info',
    base: { service },
    transport: process.env.LOG_PRETTY === 'true'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  });
}

export type Logger = ReturnType<typeof createLogger>;
