// Tests for the centralized error handler middleware.
// This is the LAST middleware in the Express chain — it catches all errors
// thrown by route handlers and returns a properly formatted JSON response.

import { describe, it, expect, vi } from "vitest";
import { errorHandler } from "./errorHandler.js";
import {
  AppError,
  NotFoundError,
  UnauthorizedError,
} from "@ecommerce/shared/errors";

// ─── Helpers ───────────────────────────────────────────────────────
function mockReq() {
  return {} as any;
}

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(), // Chainable: res.status(404).json(...)
    json: vi.fn(),
  } as any;
}

// next is required by Express error middleware signature but never called
// (error handlers are the end of the line)
const next = vi.fn();

describe("errorHandler", () => {
  it("should handle AppError with its statusCode and message", () => {
    // e.g., throw new NotFoundError('Product')
    const err = new NotFoundError("Product");
    const res = mockRes();

    errorHandler(err, mockReq(), res, next);

    // NotFoundError has statusCode 404
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Product not found",
    });
  });

  it("should handle UnauthorizedError (401)", () => {
    const err = new UnauthorizedError();
    const res = mockRes();

    errorHandler(err, mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Login first to access this resource",
    });
  });

  it("should handle MongoDB duplicate key error (code 11000)", () => {
    // When Mongoose tries to insert a document with a duplicate unique field
    // (like email), MongoDB throws this specific error
    const err = Object.assign(new Error("duplicate"), {
      name: "MongoServerError",
      code: 11000,
    });
    const res = mockRes();

    errorHandler(err, mockReq(), res, next);

    // We return 409 Conflict instead of letting a raw MongoDB error leak
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Duplicate field value entered",
    });
  });

  it("should handle Mongoose ValidationError (400)", () => {
    // Mongoose validation errors (e.g., missing required field)
    const err = Object.assign(new Error("Name is required"), {
      name: "ValidationError",
    });
    const res = mockRes();

    errorHandler(err, mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Name is required",
    });
  });

  it("should return 500 for unknown/unexpected errors", () => {
    // Programming bugs, null references, etc. — we don't leak details
    const err = new Error("something totally unexpected");
    const res = mockRes();

    // Suppress console.error output during test
    vi.spyOn(console, "error").mockImplementation(() => {});

    errorHandler(err, mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    // Generic message — never expose internal error details to clients
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Internal server error",
    });

    vi.restoreAllMocks();
  });
});
