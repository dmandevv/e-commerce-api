import { createClient } from 'redis';
import { createLogger } from '@ecommerce/shared/logger';
import { config } from '../config/index.js';

const logger = createLogger('product-service');

// Create a Redis client instance.
// createClient() returns an object that manages the TCP connection to Redis.
// It doesn't connect immediately — we call .connect() below.
const redis = createClient({ url: config.redisUrl });

// Log errors but don't crash the service. If Redis goes down,
// the service should still work — just slower (every request hits MongoDB).
redis.on('error', (err) => logger.error({ err }, 'Redis cache error'));

// Connect to Redis. Wrapped in try/catch so the service starts even if
// Redis is unavailable — caching is optional, MongoDB is the source of truth.
try {
  await redis.connect();
  logger.info('Redis cache connected');
} catch (err) {
  logger.error({ err }, 'Redis cache unavailable — running without cache');
}

// Prefix all cache keys with "products:" so they don't collide with
// cart-service keys (which share the same Redis instance).
const PREFIX = 'products:';

// Default TTL: 5 minutes (300 seconds).
// After 5 minutes, Redis automatically deletes the key.
// This means even if we miss a cache invalidation, stale data
// only lasts 5 minutes at worst.
const DEFAULT_TTL = 300;

/**
 * Try to get a cached value by key.
 * Returns the parsed object if found, or null if not cached.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(PREFIX + key);
    // redis.get() returns a string or null.
    // If null, the key doesn't exist (cache miss).
    if (!data) return null;
    // Parse the JSON string back into an object.
    return JSON.parse(data) as T;
  } catch {
    // If Redis is down or the data is corrupt, treat it as a cache miss.
    // The controller will fall through to MongoDB.
    return null;
  }
}

/**
 * Store a value in the cache with a TTL.
 * The value is serialized to JSON because Redis only stores strings.
 */
export async function cacheSet(key: string, value: unknown, ttl = DEFAULT_TTL): Promise<void> {
  try {
    // JSON.stringify converts the object to a string for storage.
    // EX sets the expiry time in seconds — after this, Redis auto-deletes the key.
    await redis.set(PREFIX + key, JSON.stringify(value), { EX: ttl });
  } catch {
    // Silently fail — caching is an optimization, not a requirement.
    // If this fails, the next request just hits MongoDB again.
  }
}

/**
 * Delete a specific cache key.
 * Called when a product is updated or deleted — we remove the stale cache
 * so the next read gets fresh data from MongoDB.
 */
export async function cacheDel(key: string): Promise<void> {
  try {
    await redis.del(PREFIX + key);
  } catch {
    // Silently fail
  }
}

/**
 * Delete all cache keys matching a pattern.
 * Called when a new product is created or any product is updated/deleted,
 * because listing pages (which cache multiple products) might be stale.
 *
 * SCAN is used instead of KEYS because KEYS blocks Redis while it searches
 * every key in the database. SCAN iterates in batches, so Redis can still
 * serve other requests between batches. This matters when you have millions
 * of keys — KEYS would freeze Redis for seconds.
 */
export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    // scanIterator returns an async iterator that yields matching keys in batches.
    // MATCH filters keys by glob pattern (e.g., "products:list:*").
    // COUNT 100 is a hint to Redis: "try to return ~100 keys per batch."
    for await (const key of redis.scanIterator({ MATCH: PREFIX + pattern, COUNT: 100 })) {
      await redis.del(key);
    }
  } catch {
    // Silently fail
  }
}
