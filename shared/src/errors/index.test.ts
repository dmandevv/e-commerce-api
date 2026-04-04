// Tests for the custom error classes used across all microservices.
// Each error extends AppError and carries a specific HTTP status code
// so the error handler middleware can return the right response.

// describe = groups related tests together (like a folder)
// it = defines a single test case (reads like English: "it should...")
// expect = makes assertions (checks that values match expectations)
import { describe, it, expect } from "vitest";
import {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  ConflictError,
} from "./index.js";

describe("AppError", () => {
  // Base class — all other errors inherit from this
  it("should set message and statusCode", () => {
    const error = new AppError("something broke", 500);

    expect(error.message).toBe("something broke");
    expect(error.statusCode).toBe(500);
  });

  it("should mark error as operational (expected, not a bug)", () => {
    const error = new AppError("expected failure", 400);

    // isOperational = true means "this is a known error we handle gracefully"
    // as opposed to a programming bug (null reference, etc.)
    expect(error.isOperational).toBe(true);
  });

  it("should be an instance of Error (so catch blocks work)", () => {
    const error = new AppError("test", 500);

    // This matters because of Object.setPrototypeOf in the constructor —
    // without it, instanceof checks fail for subclassed Error in TypeScript
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });
});

describe("NotFoundError", () => {
  it("should default to 'Resource not found' with status 404", () => {
    const error = new NotFoundError();

    expect(error.message).toBe("Resource not found");
    expect(error.statusCode).toBe(404);
  });

  it("should accept a custom resource name", () => {
    // e.g. NotFoundError("Product") → "Product not found"
    const error = new NotFoundError("Product");

    expect(error.message).toBe("Product not found");
  });

  it("should be an instance of AppError", () => {
    const error = new NotFoundError();

    // Ensures the error handler can catch it as an AppError
    expect(error).toBeInstanceOf(AppError);
  });
});

describe("UnauthorizedError", () => {
  it("should default to 401 with login prompt message", () => {
    const error = new UnauthorizedError();

    expect(error.message).toBe("Login first to access this resource");
    expect(error.statusCode).toBe(401);
  });

  it("should accept a custom message", () => {
    const error = new UnauthorizedError("Token expired");

    expect(error.message).toBe("Token expired");
  });
});

describe("ForbiddenError", () => {
  it("should default to 403 with access denied message", () => {
    const error = new ForbiddenError();

    expect(error.message).toBe("You are not allowed to access this resource");
    expect(error.statusCode).toBe(403);
  });

  it("should accept a custom message", () => {
    const error = new ForbiddenError("Admins only");

    expect(error.message).toBe("Admins only");
  });
});

describe("ValidationError", () => {
  it("should set status 400 with the provided message", () => {
    // ValidationError always requires a message — no default
    const error = new ValidationError("Email is invalid");

    expect(error.message).toBe("Email is invalid");
    expect(error.statusCode).toBe(400);
  });
});

describe("ConflictError", () => {
  it("should default to 409 with 'Resource already exists'", () => {
    const error = new ConflictError();

    expect(error.message).toBe("Resource already exists");
    expect(error.statusCode).toBe(409);
  });

  it("should accept a custom message", () => {
    const error = new ConflictError("Email already registered");

    expect(error.message).toBe("Email already registered");
  });
});
