import { createClient } from 'redis';
import { createBlacklist } from '@ecommerce/shared/middleware';
import { config } from '../config/index.js';

// One Redis connection per process, shared across all auth-protected routes.
// Blacklist reads run on EVERY authenticated request, so we want a persistent
// connection — not a new TCP handshake per request.
const redis = createClient({ url: config.redisUrl });

redis.on('error', (err) => {
  // Log but don't crash. The blacklist helper fails-open on read errors,
  // so a Redis outage degrades revocation latency, not auth itself.
  console.error('[user-service] Redis blacklist error:', err);
});

// Connect asynchronously on startup. If Redis is down at boot, we still
// let the service start — logout writes will fail-closed and surface the
// issue, while auth reads will fail-open (accept tokens normally).
try {
  await redis.connect();
  console.log('[user-service] Redis blacklist connected');
} catch (err) {
  console.error('[user-service] Redis blacklist unavailable at boot:', err);
}

// Export the helper with the Redis client already injected.
// Callers just do: `await blacklist.isBlacklisted(jti)`.
export const blacklist = createBlacklist(redis);
