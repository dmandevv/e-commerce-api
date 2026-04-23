import { createClient } from 'redis';
import { createBlacklist } from '@ecommerce/shared/middleware';
import { config } from '../config/index.js';

// Separate from the product cache client — see cart-service/lib/blacklist.ts
// for the reasoning about independent connections.
const redis = createClient({ url: config.redisUrl });

redis.on('error', (err) => {
  console.error('[product-service] Redis blacklist error:', err);
});

try {
  await redis.connect();
  console.log('[product-service] Redis blacklist connected');
} catch (err) {
  console.error('[product-service] Redis blacklist unavailable at boot:', err);
}

export const blacklist = createBlacklist(redis);
