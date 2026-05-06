import { createClient } from 'redis';
import { createBlacklist } from '@ecommerce/shared/middleware';
import { createLogger } from '@ecommerce/shared/logger';
import { config } from '../config/index.js';

const logger = createLogger('payment-service');
const redis = createClient({ url: config.redisUrl });

redis.on('error', (err) => {
  logger.error({ err }, 'Redis blacklist error');
});

try {
  await redis.connect();
  logger.info('Redis blacklist connected');
} catch (err) {
  logger.error({ err }, 'Redis blacklist unavailable at boot');
}

export const blacklist = createBlacklist(redis);
