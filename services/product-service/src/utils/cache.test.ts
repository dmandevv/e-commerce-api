// Tests for the Redis cache utility: cacheGet, cacheSet, cacheDel, cacheDelPattern.
// These functions wrap Redis operations with error handling so the product service
// keeps working even when Redis is down (graceful degradation).

// ─── Why we mock Redis ────────────────────────────────────────────
// Unit tests should never depend on external services (Redis, MongoDB, etc.).
// If we used a real Redis, tests would fail when Redis isn't running,
// and they'd be slow (network I/O). Mocking lets us test our logic
// without Redis installed.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock redis BEFORE importing cache.ts ─────────────────────────
// cache.ts calls redis.connect() at the top level (module init).
// vi.mock() is hoisted to the top of the file by Vitest — it runs
// BEFORE any imports. This prevents a real Redis connection attempt.

// vi.hoisted() creates variables that are available during mock hoisting.
// Normal const/let declarations DON'T exist yet when vi.mock() runs
// (because vi.mock is hoisted above them). vi.hoisted() solves this by
// creating the variables at the same hoisted level as vi.mock().
const { mockGet, mockSet, mockDel, mockScanIterator } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockDel: vi.fn(),
  mockScanIterator: vi.fn(),
}));

vi.mock("redis", () => ({
  // createClient() returns a fake Redis client object with mock methods.
  // The real Redis client has dozens of methods; we only mock the ones
  // cache.ts actually uses.
  createClient: () => ({
    on: vi.fn(),           // .on('error', cb) — event listener, ignored in tests
    connect: vi.fn(),      // .connect() — would open a TCP connection to Redis
    get: mockGet,          // .get(key) — read a value
    set: mockSet,          // .set(key, value, options) — write a value with TTL
    del: mockDel,          // .del(key) — delete a key
    scanIterator: mockScanIterator, // .scanIterator({MATCH, COUNT}) — iterate keys
  }),
}));

// Import AFTER mocking — when cache.ts runs its top-level code,
// it gets our fake Redis client instead of a real one.
import { cacheGet, cacheSet, cacheDel, cacheDelPattern } from "./cache.js";

// ─── Reset mocks between tests ────────────────────────────────────
// Each test should start with a clean slate — no leftover return values
// or call counts from previous tests.
beforeEach(() => {
  vi.clearAllMocks();
});

// ─── cacheGet ──────────────────────────────────────────────────────

describe("cacheGet", () => {
  it("should return parsed data on cache hit", async () => {
    // Simulate a cache hit: Redis returns a JSON string.
    // JSON.parse will convert it back to an object.
    const cachedData = { name: "Laptop", price: 999 };
    mockGet.mockResolvedValue(JSON.stringify(cachedData));

    const result = await cacheGet<{ name: string; price: number }>("item:123");

    // Verify the function called redis.get with the prefixed key.
    // PREFIX is "products:" — so the actual Redis key is "products:item:123".
    expect(mockGet).toHaveBeenCalledWith("products:item:123");
    // The function should JSON.parse the string back into an object
    expect(result).toEqual(cachedData);
  });

  it("should return null on cache miss", async () => {
    // Cache miss: Redis returns null (key doesn't exist or expired)
    mockGet.mockResolvedValue(null);

    const result = await cacheGet("item:nonexistent");

    expect(result).toBeNull();
  });

  it("should return null if Redis throws (graceful degradation)", async () => {
    // If Redis is down, the function catches the error and returns null.
    // The controller then falls through to MongoDB — no crash, just slower.
    mockGet.mockRejectedValue(new Error("Redis connection refused"));

    const result = await cacheGet("item:123");

    // Should NOT throw — returns null so the caller fetches from DB
    expect(result).toBeNull();
  });
});

// ─── cacheSet ──────────────────────────────────────────────────────

describe("cacheSet", () => {
  it("should store JSON-serialized data with default TTL", async () => {
    const data = { name: "Phone", price: 599 };

    await cacheSet("item:456", data);

    // redis.set is called with:
    // 1. Prefixed key: "products:item:456"
    // 2. JSON string: '{"name":"Phone","price":599}'
    // 3. Options: { EX: 300 } — expire after 300 seconds (5 minutes)
    expect(mockSet).toHaveBeenCalledWith(
      "products:item:456",
      JSON.stringify(data),
      { EX: 300 } // Default TTL is 300 seconds
    );
  });

  it("should accept a custom TTL", async () => {
    await cacheSet("item:789", { name: "Tablet" }, 600);

    // Custom TTL of 600 seconds (10 minutes) overrides the default
    expect(mockSet).toHaveBeenCalledWith(
      "products:item:789",
      JSON.stringify({ name: "Tablet" }),
      { EX: 600 }
    );
  });

  it("should silently fail if Redis throws", async () => {
    // Caching is optional — if it fails, we don't want the entire
    // request to fail. The product still gets returned from MongoDB.
    mockSet.mockRejectedValue(new Error("Redis write error"));

    // Should NOT throw an error
    await expect(cacheSet("item:123", { data: "test" })).resolves.toBeUndefined();
  });
});

// ─── cacheDel ──────────────────────────────────────────────────────

describe("cacheDel", () => {
  it("should delete a specific key with prefix", async () => {
    await cacheDel("item:123");

    // The PREFIX is added inside cacheDel, so the real Redis key is "products:item:123"
    expect(mockDel).toHaveBeenCalledWith("products:item:123");
  });

  it("should silently fail if Redis throws", async () => {
    mockDel.mockRejectedValue(new Error("Redis delete error"));

    // Should NOT throw — cache invalidation failure is non-critical.
    // Worst case: stale data is served for up to 5 minutes (TTL).
    await expect(cacheDel("item:123")).resolves.toBeUndefined();
  });
});

// ─── cacheDelPattern ───────────────────────────────────────────────

describe("cacheDelPattern", () => {
  it("should delete all keys matching pattern using SCAN", async () => {
    // Mock the async iterator to yield 3 keys matching "products:list:*"
    // In real Redis, SCAN iterates in batches without blocking the server.
    // Here we simulate 3 cached listing pages being invalidated.
    const matchingKeys = [
      "products:list:{\"page\":\"1\"}",
      "products:list:{\"page\":\"2\"}",
      "products:list:{\"keyword\":\"phone\"}",
    ];

    // Build an async iterable object that yields keys one by one.
    // We use the Symbol.asyncIterator protocol directly rather than an
    // async generator function — this avoids subtle timing issues in the
    // test runner where generators can be consumed incompletely.
    mockScanIterator.mockReturnValue({
      [Symbol.asyncIterator]() {
        let i = 0;
        return {
          async next() {
            if (i < matchingKeys.length) {
              return { value: matchingKeys[i++], done: false };
            }
            return { value: undefined, done: true };
          },
        };
      },
    });

    // mockDel should return a Promise (like real redis.del)
    mockDel.mockResolvedValue(1);

    await cacheDelPattern("list:*");

    // scanIterator should be called with the prefixed pattern and batch size hint.
    // MATCH: "products:list:*" — glob pattern to filter keys
    // COUNT: 100 — hint to Redis for how many keys per SCAN batch
    expect(mockScanIterator).toHaveBeenCalledWith({
      MATCH: "products:list:*",
      COUNT: 100,
    });

    // Each matching key should be individually deleted
    expect(mockDel).toHaveBeenCalledTimes(3);
    expect(mockDel).toHaveBeenCalledWith("products:list:{\"page\":\"1\"}");
    expect(mockDel).toHaveBeenCalledWith("products:list:{\"page\":\"2\"}");
    expect(mockDel).toHaveBeenCalledWith("products:list:{\"keyword\":\"phone\"}");
  });

  it("should handle no matching keys gracefully", async () => {
    // If no keys match the pattern, the iterator yields nothing.
    // This is fine — nothing to delete.
    mockScanIterator.mockReturnValue(
      (async function* () {
        // Empty — no keys match
      })()
    );

    await cacheDelPattern("list:*");

    // scanIterator was called, but del was never called (no keys to delete)
    expect(mockScanIterator).toHaveBeenCalled();
    expect(mockDel).not.toHaveBeenCalled();
  });

  it("should silently fail if Redis throws during scan", async () => {
    mockScanIterator.mockImplementation(() => {
      throw new Error("Redis scan error");
    });

    // Should NOT throw — pattern deletion is best-effort
    await expect(cacheDelPattern("list:*")).resolves.toBeUndefined();
  });
});
