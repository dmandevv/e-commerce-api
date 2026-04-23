/**
 * Blacklist helper — revokes JWTs by jti.
 *
 * Writes: logout handler pushes jti to Redis with TTL = remaining token life.
 * Reads: auth middleware checks every authenticated request.
 * Cleanup: Redis TTL auto-expires entries — no cron needed.
 *
 * Behavior on Redis failure:
 *   - Read (isBlacklisted) → fail-open (return false, log error)
 *       Rationale: keep app up during Redis blip; accept small revocation
 *       latency risk. At-scale mitigations (local cache, pub/sub) deferred.
 *   - Write (blacklistToken) → fail-closed (throw)
 *       Rationale: a silently-failed revocation is a security hole.
 *       Caller should surface the error.
 */

// Structural type. Shared doesn't import `redis` directly —
// any client with these two methods satisfies the interface.
export interface BlacklistStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: { EX: number }): Promise<unknown>;
}

const PREFIX = 'blacklist:';

export function createBlacklist(store: BlacklistStore) {
  return {
    async isBlacklisted(jti: string): Promise<boolean> {
      try {
        const value = await store.get(PREFIX + jti);
        return value !== null;
      } catch (err) {
        console.error('[blacklist] Redis unavailable — failing open:', err);
        return false;
      }
    },

    async blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
      if (ttlSeconds <= 0) return; // already expired — no-op
      await store.set(PREFIX + jti, '1', { EX: ttlSeconds });
    },
  };
}
