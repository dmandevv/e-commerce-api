import { describe, it, expect, vi } from 'vitest';
import { createBlacklist, type BlacklistStore } from './blacklist.js';

// Build a fake store whose behavior is controlled by the test.
// Shared structural typing means this mock directly satisfies BlacklistStore.
function makeStore(overrides: Partial<BlacklistStore> = {}): BlacklistStore {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    ...overrides,
  };
}

describe('createBlacklist', () => {
  // ─── isBlacklisted ─────────────────────────────────────
  describe('isBlacklisted', () => {
    it('returns false when jti is not in the store', async () => {
      const store = makeStore();
      const { isBlacklisted } = createBlacklist(store);

      expect(await isBlacklisted('jti-xyz')).toBe(false);
      expect(store.get).toHaveBeenCalledWith('blacklist:jti-xyz');
    });

    it('returns true when jti is present', async () => {
      const store = makeStore({
        get: vi.fn().mockResolvedValue('1'),
      });
      const { isBlacklisted } = createBlacklist(store);

      expect(await isBlacklisted('jti-xyz')).toBe(true);
    });

    it('returns false (fail-open) when Redis throws', async () => {
      const store = makeStore({
        get: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      });
      const { isBlacklisted } = createBlacklist(store);

      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(await isBlacklisted('jti-xyz')).toBe(false);
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining('failing open'),
        expect.any(Error)
      );
      errSpy.mockRestore();
    });
  });

  // ─── blacklistToken ────────────────────────────────────
  describe('blacklistToken', () => {
    it('writes to the store with correct key, value, and TTL', async () => {
      const store = makeStore();
      const { blacklistToken } = createBlacklist(store);

      await blacklistToken('jti-xyz', 900); // 15 min

      expect(store.set).toHaveBeenCalledWith(
        'blacklist:jti-xyz',
        '1',
        { EX: 900 }
      );
    });

    it('no-ops when ttlSeconds is 0 or negative', async () => {
      const store = makeStore();
      const { blacklistToken } = createBlacklist(store);

      await blacklistToken('jti-expired', 0);
      await blacklistToken('jti-past', -5);

      expect(store.set).not.toHaveBeenCalled();
    });

    it('throws (fail-closed) when Redis write fails', async () => {
      const store = makeStore({
        set: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      });
      const { blacklistToken } = createBlacklist(store);

      await expect(blacklistToken('jti-xyz', 900)).rejects.toThrow(
        'ECONNREFUSED'
      );
    });
  });
});
