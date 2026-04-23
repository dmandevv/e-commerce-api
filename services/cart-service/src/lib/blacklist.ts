import { createClient } from 'redis';
import { createBlacklist } from '@ecommerce/shared/middleware';
import { config } from '../config/index.js';

// Separate Redis connection from the cart data client.
// Keeping them independent means a blacklist-heavy auth storm can't starve
// cart reads (and vice versa). Both hit the same Redis server — just different
// TCP connections with their own command queues.
const redis = createClient({ url: config.redisUrl });

redis.on('error', (err) => {
  console.error('[cart-service] Redis blacklist error:', err);
});

try {
  await redis.connect();
  console.log('[cart-service] Redis blacklist connected');
} catch (err) {
  console.error('[cart-service] Redis blacklist unavailable at boot:', err);
}

export const blacklist = createBlacklist(redis);
