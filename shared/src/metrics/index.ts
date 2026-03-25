import { Registry, collectDefaultMetrics, Histogram, Counter } from 'prom-client';
import type { Request, Response, NextFunction } from 'express';

// Each service gets its own registry so metrics don't collide
// when running multiple services in the same process (e.g., tests).
const register = new Registry();

// Automatically collect Node.js internals:
// - process_cpu_seconds_total
// - nodejs_heap_size_bytes
// - nodejs_eventloop_lag_seconds
// These are free — no code needed per service.
collectDefaultMetrics({ register });

// Histogram: tracks the distribution of request durations.
// Labels let us filter in Grafana: "show me only POST /api/orders that returned 500"
const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['service', 'method', 'path', 'status'] as const,
  // Buckets define the boundaries. A request taking 0.08s falls into the 0.1 bucket.
  // These cover: fast cache hits (5ms) → normal reads (50-100ms) → slow writes (500ms-1s) → timeouts (5s)
  buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

// Counter: tracks the total number of requests. Unlike a histogram,
// a counter only goes up — it never resets (until the process restarts).
// Prometheus calculates rates from counters: "requests per second" = rate(http_requests_total[5m])
const httpRequests = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['service', 'method', 'path', 'status'] as const,
  registers: [register],
});

// Normalize paths like /api/products/abc123 → /api/products/:id
// Without this, every unique product ID creates a separate time series,
// which explodes Prometheus memory ("cardinality explosion").
function normalizePath(path: string): string {
  return path
    .replace(/\/[a-f0-9]{24}/g, '/:id')       // MongoDB ObjectIDs (24 hex chars)
    .replace(/\/[0-9]+/g, '/:id')              // Numeric IDs
    .replace(/\/[0-9a-f-]{36}/g, '/:id');      // UUIDs
}

/**
 * Express middleware that records request duration and count.
 * Call once with the service name, use as app.use(metricsMiddleware('product-service')).
 */
export function metricsMiddleware(serviceName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip the /metrics and /health endpoints — we don't want monitoring
    // requests to pollute the actual traffic metrics.
    if (req.path === '/metrics' || req.path === '/health') {
      next();
      return;
    }

    const end = httpDuration.startTimer();

    // res.on('finish') fires when the response has been fully sent.
    // At that point we know the final status code.
    res.on('finish', () => {
      const labels = {
        service: serviceName,
        method: req.method,
        path: normalizePath(req.path),
        status: String(res.statusCode),
      };
      end(labels);
      httpRequests.inc(labels);
    });

    next();
  };
}

/**
 * Route handler for GET /metrics.
 * Returns all metrics in Prometheus text exposition format.
 */
export async function metricsEndpoint(_req: Request, res: Response): Promise<void> {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}
