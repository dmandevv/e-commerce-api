// Tests for the shared middleware: requestId and validate.
// These middlewares run on every request across all services.

import { describe, it, expect, vi } from "vitest";
import { requestId, validate, csrfProtection, issueCsrfToken } from "./index.js";
// z is Zod — the schema validation library used for request body parsing
import { any, z } from "zod";
import { fa } from "zod/locales";

// ─── Helper: create fake Express req/res/next objects ───────────────
// In real Express, req/res are complex objects with many methods.
// For unit tests, we only create the parts our middleware actually uses.
// This avoids needing a real HTTP server.

function mockReq(overrides: Record<string, unknown> = {}) {
  return {
    headers: {},  // HTTP headers (e.g., X-Request-Id)
    body: {},     // POST/PUT body (validated by Zod)
    ...overrides, // Merge any test-specific overrides
  } as any; // "as any" bypasses strict Express typing — acceptable in tests
}

function mockRes() {
  return {
    // setHeader is called by requestId middleware to send X-Request-Id back
    setHeader: vi.fn(), // vi.fn() creates a spy — we can check if it was called
    // status() returns the res object for chaining: res.status(400).json({...})
    status: vi.fn().mockReturnThis(),
    // json() sends the response body
    json: vi.fn(),
  } as any;
}

function mockCsrfReq(overrides: { method?: string; cookies?: Record<string, string>; headers?: Record<string, string> } = {}) {
  return {
    method: overrides.method ?? 'POST',
    cookies: overrides.cookies ?? {},
    headers: overrides.headers ?? {},
  } as any;
}

function mockCsrfRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    cookie: vi.fn(),
  } as any;
}

// ─── requestId middleware ───────────────────────────────────────────

describe("requestId middleware", () => {
  it("should generate a UUID if no X-Request-Id header exists", () => {
    const req = mockReq();
    const res = mockRes();
    // next() is the Express callback that passes control to the next middleware
    const next = vi.fn();

    requestId(req, res, next);

    // req.requestId should now be a UUID (36 chars: 8-4-4-4-12 format)
    expect(req.requestId).toBeDefined();
    expect(req.requestId).toHaveLength(36);
    // The middleware should set the response header so the client can see it
    expect(res.setHeader).toHaveBeenCalledWith("X-Request-Id", req.requestId);
    // next() must be called — otherwise the request hangs forever
    expect(next).toHaveBeenCalled();
  });

  it("should reuse existing X-Request-Id from the gateway", () => {
    // When a request comes through NGINX, it already has an X-Request-Id
    const req = mockReq({
      headers: { "x-request-id": "existing-id-from-gateway" },
    });
    const res = mockRes();
    const next = vi.fn();

    requestId(req, res, next);

    // Should keep the gateway's ID, not generate a new one
    expect(req.requestId).toBe("existing-id-from-gateway");
    expect(res.setHeader).toHaveBeenCalledWith(
      "X-Request-Id",
      "existing-id-from-gateway"
    );
  });
});

// ─── validate middleware ────────────────────────────────────────────

describe("validate middleware", () => {
  // Define a Zod schema: body must have name (string) and age (number, min 0)
  const testSchema = z.object({
    name: z.string(),
    age: z.number().min(0),
  });

  it("should call next() when body matches schema", () => {
    const req = mockReq({ body: { name: "John", age: 25 } });
    const res = mockRes();
    const next = vi.fn();

    // validate() returns a middleware function — call it immediately
    validate(testSchema)(req, res, next);

    // Validation passed — next() should be called to continue the request
    expect(next).toHaveBeenCalled();
    // req.body should be replaced with the Zod-parsed (clean) version
    expect(req.body).toEqual({ name: "John", age: 25 });
  });

  it("should return 400 with field errors when validation fails", () => {
    // Missing "name", "age" is a string instead of number
    const req = mockReq({ body: { age: "not-a-number" } });
    const res = mockRes();
    const next = vi.fn();

    validate(testSchema)(req, res, next);

    // Should NOT call next — the request is rejected
    expect(next).not.toHaveBeenCalled();
    // Should return 400 Bad Request
    expect(res.status).toHaveBeenCalledWith(400);
    // Response body should have success: false and an errors array
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        errors: expect.arrayContaining([
          // Each error has a field path and human-readable message
          expect.objectContaining({ field: expect.any(String) }),
        ]),
      })
    );
  });

  it("should strip unknown fields from body (Zod default behavior)", () => {
    // "extra" is not in the schema — Zod strips it by default
    const req = mockReq({ body: { name: "John", age: 25, extra: "hack" } });
    const res = mockRes();
    const next = vi.fn();

    validate(testSchema)(req, res, next);

    // req.body should only have the schema-defined fields
    expect(req.body).toEqual({ name: "John", age: 25 });
    expect(req.body.extra).toBeUndefined();
  });
});

// ─── csrfProtection middleware ──────────────────────────────────────

describe('csrfProtection middleware', () => {
  it('should skip token check for get requests', () => {
    const req = mockCsrfReq({ method: 'GET' });
    const res = mockCsrfRes();
    const next = vi.fn();

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
  it('should reject with 403 when CSRF cookie is missing (foreign origin attack)', () => {
    const req = mockCsrfReq({
      headers: { 'x-csrf-token': 'hacker-actually-guessed-token' }
    });
    const res = mockCsrfRes();
    const next = vi.fn();

    csrfProtection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'CSRF validation failed' });
  });
  it('should reject with 403 when CSRF header is missing (client error)', () =>{
    const req = mockCsrfReq({
      cookies: { csrfToken: 'valid-token' }
    });
    const res = mockCsrfRes();
    const next = vi.fn();

    csrfProtection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'CSRF validation failed' });
  }); 
  it('should reject with 403 when cookie and header lengths differ', () => {
    const req = mockCsrfReq({
      cookies: { csrfToken: 'short-token' },
      headers: { 'x-csrf-token': 'much-longer-token' }
    });
    const res = mockCsrfRes();
    const next = vi.fn();

    csrfProtection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'CSRF validation failed' });

  });
  it('should reject with 403 when cookie and header lengths are same but values differ', () => {
    const req = mockCsrfReq({
      cookies: { csrfToken: 'token1' },
      headers: { 'x-csrf-token': 'token2' }
    });
    const res = mockCsrfRes();
    const next = vi.fn();

    csrfProtection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'CSRF validation failed' });
  });
  it('should call next() when cookie and header tokens match', () => {
    const req = mockCsrfReq({
      cookies: { csrfToken: 'token' },
      headers: { 'x-csrf-token': 'token' }
    });
    const res = mockCsrfRes();
    const next = vi.fn();

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

});

// ─── issueCsrfToken helper ──────────────────────────────────────────

describe('issueCsrfToken helper', () => {
  it('should return a 64 byte hex string', () => {
    const res = mockCsrfRes();
    const token = issueCsrfToken(res, { secure: false });

    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });
  it('should set cookie with httpOnly:false so frontend JS can read it', () => {
    const res = mockCsrfRes();
    const token = issueCsrfToken(res, { secure: false });

    expect(res.cookie).toHaveBeenCalledWith(
      'csrfToken', 
      token,
      expect.objectContaining({ 
        httpOnly: false,
        sameSite: 'lax',
        maxAge: 2 * 60 * 60 * 1000, //2 hours
        path: '/',
      })
    );
  });
  it('should set respect the secure flag', () => {
    const resProduction = mockCsrfRes();
    const resDevelop = mockCsrfRes();
    issueCsrfToken(resProduction, { secure: true });
    issueCsrfToken(resDevelop, { secure: false });

    expect(resProduction.cookie).toHaveBeenCalledWith(
      'csrfToken', 
      expect.any(String),
      expect.objectContaining({ secure: true })
    );
    expect(resDevelop.cookie).toHaveBeenCalledWith(
      'csrfToken', 
      expect.any(String),
      expect.objectContaining({ secure: false })
    );
  });
});