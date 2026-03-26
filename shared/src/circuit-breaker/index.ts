// ─── Circuit Breaker States ─────────────────────────────
// CLOSED:    Normal operation. Requests pass through. Failures are counted.
// OPEN:      Too many failures. Requests are rejected instantly (fail-fast).
// HALF_OPEN: Cooldown expired. ONE test request is allowed through.
//            If it succeeds → CLOSED. If it fails → OPEN again.
type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

// ─── Configuration ──────────────────────────────────────
interface CircuitBreakerOptions {
  // How many failures before the breaker trips open.
  // Default: 5. Meaning: "if 5 requests in a row fail, stop trying."
  failureThreshold: number;

  // How long (ms) to stay OPEN before testing again.
  // Default: 30000 (30 seconds). During this time, all requests fail instantly.
  resetTimeout: number;

  // Name for logging — so you can see "circuit breaker [product-service] opened"
  // instead of a generic message.
  name: string;
}

// ─── Default values ─────────────────────────────────────
const DEFAULTS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeout: 30_000,
  name: 'unknown',
};

export class CircuitBreaker {
  // Current state of the breaker.
  private state: State = 'CLOSED';

  // How many consecutive failures have occurred.
  // Resets to 0 on any success.
  private failureCount = 0;

  // Timestamp of when the breaker tripped OPEN.
  // Used to calculate when to transition to HALF_OPEN.
  private lastFailureTime = 0;

  // Merged options (user-provided + defaults).
  private options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> & { name: string }) {
    // Spread DEFAULTS first, then override with user-provided values.
    // The "& { name: string }" ensures name is always required.
    this.options = { ...DEFAULTS, ...options };
  }

  /**
   * Execute a function through the circuit breaker.
   *
   * Usage:
   *   const breaker = new CircuitBreaker({ name: 'product-service' });
   *   const response = await breaker.fire(() => fetch('http://product-service:3002/...'));
   *
   * The generic <T> means the return type matches whatever the wrapped function returns.
   * If you pass () => fetch(...), T is Response. If you pass () => getUser(...), T is User.
   */
  async fire<T>(fn: () => Promise<T>): Promise<T> {
    // ─── OPEN state: fail immediately ───────────────────
    if (this.state === 'OPEN') {
      // Check if enough time has passed to try again.
      // Date.now() returns milliseconds since epoch.
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeout) {
        this.state = 'HALF_OPEN';
        console.log(`Circuit breaker [${this.options.name}] half-open — testing`);
      } else {
        // Still within cooldown — reject the request instantly.
        // This is the "fail-fast" behavior. Instead of waiting 30 seconds
        // for a timeout, the caller gets an error in <1ms.
        throw new Error(
          `Circuit breaker [${this.options.name}] is OPEN — request blocked`
        );
      }
    }

    // ─── CLOSED or HALF_OPEN: try the request ───────────
    try {
      // Actually execute the wrapped function (e.g., fetch()).
      const result = await fn();

      // Success — reset everything.
      // If we were HALF_OPEN, this success proves the service is back.
      this.onSuccess();
      return result;
    } catch (err) {
      // Failure — record it and possibly trip the breaker.
      this.onFailure();
      // Re-throw so the caller still gets the error.
      // The circuit breaker doesn't swallow errors — it just tracks them.
      throw err;
    }
  }

  /**
   * Called on successful request.
   * Resets failure count and closes the breaker.
   */
  private onSuccess(): void {
    // If we were HALF_OPEN, the test request succeeded — service is back.
    if (this.state === 'HALF_OPEN') {
      console.log(`Circuit breaker [${this.options.name}] closed — service recovered`);
    }
    // Reset to healthy state regardless of previous state.
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  /**
   * Called on failed request.
   * Increments failure count. If threshold is reached, trips the breaker open.
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    // If we were HALF_OPEN, the test request failed — go back to OPEN.
    // Don't wait for failureThreshold — one failure in HALF_OPEN is enough
    // to know the service is still down.
    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      console.log(`Circuit breaker [${this.options.name}] re-opened — service still down`);
      return;
    }

    // In CLOSED state, check if we've hit the threshold.
    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'OPEN';
      console.log(
        `Circuit breaker [${this.options.name}] opened after ${this.failureCount} failures`
      );
    }
  }

  /**
   * Expose current state for health checks / monitoring.
   * This lets the health dashboard show which circuit breakers are tripped.
   */
  getState(): State {
    return this.state;
  }
}