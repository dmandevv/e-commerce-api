import { createClient } from 'redis';
import { createBlacklist } from '@ecommerce/shared/middleware';
import { config } from '../config/index.js';

const redis = createClient({ url: config.redisUrl });

redis.on('error', (err) => {
  console.error('[payment-service] Redis blacklist error:', err);
});

try {
  await redis.connect();
  console.log('[payment-service] Redis blacklist connected');
} catch (err) {
  console.error('[payment-service] Redis blacklist unavailable at boot:', err);
}

export const blacklist = createBlacklist(redis);
