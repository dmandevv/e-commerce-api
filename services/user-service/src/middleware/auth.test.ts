// Tests for authenticate and authorize middleware.
// These protect routes — authenticate checks JWT, authorize checks roles.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { authenticate, authorize } from "./auth.js";

// ─── Mock jsonwebtoken ─────────────────────────────────────────────
// vi.mock() replaces the real module with a fake one.
// This means jwt.verify() won't actually verify a token — we control
// what it returns, so we can test both valid and invalid scenarios.
vi.mock("jsonwebtoken", () => ({
  default: {
    // By default, verify() returns a decoded payload.
    // Individual tests can override this with mockImplementation().
    verify: vi.fn().mockReturnValue({ id: "user123", role: "customer" }),
  },
}));

// ─── Mock config ───────────────────────────────────────────────────
// Replace the real config (which reads .env and calls process.exit)
// with a simple object containing just what auth.ts needs.
vi.mock("../config/index.js", () => ({
  config: { jwtSecret: "test-secret" },
}));

// ─── Import mocked jwt so we can change its behavior per test ──────
import jwt from "jsonwebtoken";

// ─── Helpers ───────────────────────────────────────────────────────
function mockReq(overrides: Record<string, unknown> = {}) {
  return { headers: {}, ...overrides } as any;
}

function mockRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
}

// ─── authenticate ──────────────────────────────────────────────────

describe("authenticate", () => {
  beforeEach(() => {
    // Reset mock state between tests so one test's setup doesn't leak
    vi.clearAllMocks();
  });

  it("should throw UnauthorizedError if no Authorization header", () => {
    const req = mockReq(); // No headers.authorization
    const res = mockRes();
    const next = vi.fn();

    // authenticate is synchronous and throws — wrap in expect().toThrow()
    expect(() => authenticate(req, res, next)).toThrow(
      "Login first to access this resource"
    );
    // next() should NOT be called — request is rejected
    expect(next).not.toHaveBeenCalled();
  });

  it("should throw UnauthorizedError if header doesn't start with 'Bearer '", () => {
    // Some clients send "Token xxx" or just the raw token — our middleware
    // requires the OAuth2 standard "Bearer " prefix
    const req = mockReq({ headers: { authorization: "Token abc123" } });
    const res = mockRes();
    const next = vi.fn();

    expect(() => authenticate(req, res, next)).toThrow(
      "Login first to access this resource"
    );
  });

  it("should set req.user and call next() with a valid token", () => {
    const req = mockReq({
      headers: { authorization: "Bearer valid-token" },
    });
    const res = mockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    // jwt.verify was called with the token (after splitting "Bearer xxx")
    // and our test secret
    expect(jwt.verify).toHaveBeenCalledWith("valid-token", "test-secret");
    // The decoded payload should be attached to req.user
    expect(req.user).toEqual({ id: "user123", role: "customer" });
    // next() called — request continues to the route handler
    expect(next).toHaveBeenCalled();
  });

  it("should throw UnauthorizedError if token verification fails", () => {
    // Override verify() to throw (simulates expired or tampered token)
    vi.mocked(jwt.verify).mockImplementationOnce(() => {
      throw new Error("jwt expired");
    });

    const req = mockReq({
      headers: { authorization: "Bearer expired-token" },
    });
    const res = mockRes();
    const next = vi.fn();

    expect(() => authenticate(req, res, next)).toThrow(
      "Invalid or expired token"
    );
  });

  it("should set req.user and call next() with a valid cookie token", () => {
    const req = mockReq({ cookies: { accessToken: "cookie-token" } });
    const res = mockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    // jwt.verify was called with the token (after splitting "Bearer xxx")
    // and our test secret
    expect(jwt.verify).toHaveBeenCalledWith("cookie-token", "test-secret");
    // The decoded payload should be attached to req.user
    expect(req.user).toEqual({ id: "user123", role: "customer" });
    // next() called — request continues to the route handler
    expect(next).toHaveBeenCalled();
  });

  it("should prefer cookie token over Bearer header when both are present", () => {
    const req = mockReq({ 
      headers: { authorization: "Bearer bearer-token" },
      cookies: { accessToken: "cookie-token" },
    });
    const res = mockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith("cookie-token", "test-secret");
    expect(next).toHaveBeenCalled();
  });

  it("should throw UnauthorizedError if neither cookie nor Bearer header present", () => {
    // Empty cookies AND empty headers
    const req = mockReq({ cookies: {} });
    const res = mockRes();
    const next = vi.fn();

    expect(() => authenticate(req, res, next)).toThrow(
      "Login first to access this resource"
    );
    expect(next).not.toHaveBeenCalled();
  });

});

// ─── authorize ─────────────────────────────────────────────────────

describe("authorize", () => {
  it("should call next() if user role is in allowed list", () => {
    // authorize('admin', 'customer') returns a middleware function
    const middleware = authorize("admin", "customer");
    const req = mockReq({ user: { id: "user123", role: "customer" } });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    // Customer is in the allowed list — request continues
    expect(next).toHaveBeenCalled();
  });

  it("should throw ForbiddenError if user role is not allowed", () => {
    // Only admins allowed
    const middleware = authorize("admin");
    // But user is a customer
    const req = mockReq({ user: { id: "user123", role: "customer" } });
    const res = mockRes();
    const next = vi.fn();

    expect(() => middleware(req, res, next)).toThrow(
      "Role (customer) is not allowed to access this resource"
    );
  });

  it("should throw ForbiddenError if req.user is missing", () => {
    // No user at all — authenticate wasn't called or was bypassed
    const middleware = authorize("admin");
    const req = mockReq(); // no req.user
    const res = mockRes();
    const next = vi.fn();

    expect(() => middleware(req, res, next)).toThrow();
  });
});
