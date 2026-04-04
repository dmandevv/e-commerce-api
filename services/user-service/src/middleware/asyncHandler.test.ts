// Tests for asyncHandler — a utility that wraps async route handlers
// so that thrown errors are automatically passed to Express's next().
// Without this, unhandled promise rejections would crash the process
// instead of reaching the errorHandler middleware.

import { describe, it, expect, vi } from "vitest";
import { asyncHandler } from "./asyncHandler.js";

function mockReq() {
  return {} as any;
}

function mockRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
}

describe("asyncHandler", () => {
  it("should call the wrapped function normally when it succeeds", async () => {
    // A simple async handler that sends a response
    const handler = vi.fn().mockResolvedValue(undefined);
    // asyncHandler takes our async function and returns a new sync function
    // that Express can use as a route handler
    const wrapped = asyncHandler(handler);
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    // Call the wrapped handler (this starts the async work)
    wrapped(req, res, next);

    // Wait for the internal promise to resolve
    // setTimeout(fn, 0) pushes to the next tick of the event loop,
    // giving the promise time to settle
    await new Promise((r) => setTimeout(r, 0));

    // The original handler was called with req, res, next
    expect(handler).toHaveBeenCalledWith(req, res, next);
    // next() should NOT be called — no error occurred
    expect(next).not.toHaveBeenCalled();
  });

  it("should call next(error) when the wrapped function throws", async () => {
    // Simulate an async handler that throws (e.g., database connection failed)
    const error = new Error("database connection failed");
    // mockRejectedValue makes the function return a rejected promise
    const handler = vi.fn().mockRejectedValue(error);
    const wrapped = asyncHandler(handler);
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    wrapped(req, res, next);

    // Wait for the rejected promise to trigger .catch(next)
    await new Promise((r) => setTimeout(r, 0));

    // next() should be called WITH the error — this forwards it
    // to the errorHandler middleware instead of crashing the process
    expect(next).toHaveBeenCalledWith(error);
  });
});
