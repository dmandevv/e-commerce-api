import { createClient } from 'redis';
import { createBlacklist } from '@ecommerce/shared/middleware';
import { createLogger } from '@ecommerce/shared/logger';
import { config } from '../config/index.js';

const logger = createLogger('cart-service');

// Separate Redis connection from the cart data client.
// Keeping them independent means a blacklist-heavy auth storm can't starve
// cart reads (and vice versa). Both hit the same Redis server — just different
// TCP connections with their own command queues.
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
