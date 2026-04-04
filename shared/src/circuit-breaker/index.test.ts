// Tests for the CircuitBreaker class.
// The circuit breaker protects inter-service calls (e.g., order-service calling product-service).
// It has 3 states: CLOSED (normal) → OPEN (fail-fast) → HALF_OPEN (testing recovery).

// describe = groups related tests
// it = single test case
// expect = assertion checker
// vi = Vitest's utility object for mocking, fake timers, spies, etc.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CircuitBreaker } from "./index.js";

describe("CircuitBreaker", () => {
  // Fresh breaker for each test so state doesn't leak between tests
  let breaker: CircuitBreaker;

  beforeEach(() => {
    // Create a breaker that opens after 3 failures (lower than default 5 for faster tests)
    // and waits 1000ms before trying again (lower than default 30s)
    breaker = new CircuitBreaker({
      name: "test-service",
      failureThreshold: 3,
      resetTimeout: 1000,
    });
  });

  it("should start in CLOSED state", () => {
    // A new breaker is always CLOSED — all requests pass through
    expect(breaker.getState()).toBe("CLOSED");
  });

  it("should pass through successful calls in CLOSED state", async () => {
    // fire() wraps any async function — here it just resolves to "ok"
    const result = await breaker.fire(() => Promise.resolve("ok"));

    expect(result).toBe("ok");
    // State stays CLOSED after a success
    expect(breaker.getState()).toBe("CLOSED");
  });

  it("should stay CLOSED when failures are below threshold", async () => {
    // Fail twice — threshold is 3, so breaker should NOT open
    for (let i = 0; i < 2; i++) {
      // We expect this to throw, so we catch it to prevent test failure
      await breaker.fire(() => Promise.reject(new Error("fail"))).catch(() => {});
    }

    // Still CLOSED because 2 < 3 (threshold)
    expect(breaker.getState()).toBe("CLOSED");
  });

  it("should OPEN after reaching failure threshold", async () => {
    // Fail 3 times — exactly the threshold
    for (let i = 0; i < 3; i++) {
      await breaker.fire(() => Promise.reject(new Error("fail"))).catch(() => {});
    }

    // Now the breaker is OPEN — no more requests will pass through
    expect(breaker.getState()).toBe("OPEN");
  });

  it("should reject calls immediately when OPEN (fail-fast)", async () => {
    // Trip the breaker open
    for (let i = 0; i < 3; i++) {
      await breaker.fire(() => Promise.reject(new Error("fail"))).catch(() => {});
    }

    // This call should be rejected instantly WITHOUT executing the function
    await expect(
      breaker.fire(() => Promise.resolve("should not run"))
    ).rejects.toThrow("Circuit breaker [test-service] is OPEN");
  });

  it("should transition to HALF_OPEN after resetTimeout expires", async () => {
    // vi.useFakeTimers() lets us control time — instead of waiting 1000ms,
    // we can instantly jump forward with vi.advanceTimersByTime()
    vi.useFakeTimers();

    // Trip the breaker open
    for (let i = 0; i < 3; i++) {
      await breaker.fire(() => Promise.reject(new Error("fail"))).catch(() => {});
    }
    expect(breaker.getState()).toBe("OPEN");

    // Fast-forward past the resetTimeout (1000ms)
    vi.advanceTimersByTime(1001);

    // The next call should be allowed through (HALF_OPEN test request)
    // If it succeeds, the breaker closes
    await breaker.fire(() => Promise.resolve("recovered"));

    expect(breaker.getState()).toBe("CLOSED");

    // Restore real timers so other tests aren't affected
    vi.useRealTimers();
  });

  it("should re-OPEN if the HALF_OPEN test request fails", async () => {
    vi.useFakeTimers();

    // Trip open
    for (let i = 0; i < 3; i++) {
      await breaker.fire(() => Promise.reject(new Error("fail"))).catch(() => {});
    }

    // Fast-forward past resetTimeout
    vi.advanceTimersByTime(1001);

    // The HALF_OPEN test request fails — breaker goes back to OPEN
    await breaker.fire(() => Promise.reject(new Error("still down"))).catch(() => {});

    expect(breaker.getState()).toBe("OPEN");

    vi.useRealTimers();
  });

  it("should reset failure count on success", async () => {
    // Fail twice (below threshold of 3)
    await breaker.fire(() => Promise.reject(new Error("fail"))).catch(() => {});
    await breaker.fire(() => Promise.reject(new Error("fail"))).catch(() => {});

    // One success should reset the counter back to 0
    await breaker.fire(() => Promise.resolve("ok"));

    // Now fail twice more — should NOT open because counter was reset
    await breaker.fire(() => Promise.reject(new Error("fail"))).catch(() => {});
    await breaker.fire(() => Promise.reject(new Error("fail"))).catch(() => {});

    // Still CLOSED: 2 failures since last success, not 4 total
    expect(breaker.getState()).toBe("CLOSED");
  });
});
