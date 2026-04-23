// Tests for the shared createAuthenticate factory + authorize middleware.
// These are the single source of truth across all services — each service
// wires them up with its own config.jwtSecret and blacklist client.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuthenticate, authorize } from './auth.js';

// ─── Mock jsonwebtoken ──────────────────────────────────
// jwt.verify is swapped with a controllable mock. Default returns a valid
// payload; individual tests override with mockImplementationOnce for edge cases.
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn().mockReturnValue({
      id: 'user123',
      role: 'customer',
      jti: 'jti-abc',
    }),
  },
}));

import jwt from 'jsonwebtoken';

// ─── Helpers ────────────────────────────────────────────
function mockReq(overrides: Record<string, unknown> = {}) {
  return { headers: {}, ...overrides } as any;
}

function mockRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
}

// A minimal BlacklistStore implementation with controllable behavior.
function makeBlacklist(isBlacklistedReturn: boolean) {
  return { isBlacklisted: vi.fn().mockResolvedValue(isBlacklistedReturn) };
}

// ─── Token extraction ──────────────────────────────────
// These tests work with OR without a blacklist — blacklist-specific
// behavior is tested separately below.
describe('authenticate — token extraction', () => {
  const authenticate = createAuthenticate({ jwtSecret: 'test-secret' });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(jwt.verify).mockReturnValue({
      id: 'user123',
      role: 'customer',
      jti: 'jti-abc',
    } as any);
  });

  it('throws UnauthorizedError when no token is present', async () => {
    const req = mockReq();
    const next = vi.fn();
    await expect(authenticate(req, mockRes(), next)).rejects.toThrow(
      'Login first to access this resource'
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('throws when Authorization header does not start with "Bearer "', async () => {
    const req = mockReq({ headers: { authorization: 'Token abc123' } });
    await expect(authenticate(req, mockRes(), vi.fn())).rejects.toThrow(
      'Login first to access this resource'
    );
  });

  it('accepts a Bearer token and sets req.user', async () => {
    const req = mockReq({ headers: { authorization: 'Bearer valid-token' } });
    const next = vi.fn();

    await authenticate(req, mockRes(), next);

    expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
    expect(req.user).toEqual({
      id: 'user123',
      role: 'customer',
      jti: 'jti-abc',
    });
    expect(next).toHaveBeenCalled();
  });

  it('accepts a cookie token and sets req.user', async () => {
    const req = mockReq({ cookies: { accessToken: 'cookie-token' } });
    const next = vi.fn();

    await authenticate(req, mockRes(), next);

    expect(jwt.verify).toHaveBeenCalledWith('cookie-token', 'test-secret');
    expect(next).toHaveBeenCalled();
  });

  it('prefers cookie over Bearer when both are present', async () => {
    const req = mockReq({
      headers: { authorization: 'Bearer bearer-token' },
      cookies: { accessToken: 'cookie-token' },
    });

    await authenticate(req, mockRes(), vi.fn());

    expect(jwt.verify).toHaveBeenCalledWith('cookie-token', 'test-secret');
  });

  it('throws UnauthorizedError when jwt.verify fails', async () => {
    vi.mocked(jwt.verify).mockImplementationOnce(() => {
      throw new Error('jwt expired');
    });
    const req = mockReq({ headers: { authorization: 'Bearer expired' } });

    await expect(authenticate(req, mockRes(), vi.fn())).rejects.toThrow(
      'Invalid or expired token'
    );
  });
});

// ─── Blacklist integration ─────────────────────────────
describe('authenticate — blacklist integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(jwt.verify).mockReturnValue({
      id: 'user123',
      role: 'customer',
      jti: 'jti-abc',
    } as any);
  });

  it('skips blacklist check when no blacklist is configured', async () => {
    const authenticate = createAuthenticate({ jwtSecret: 'test-secret' });
    const req = mockReq({ headers: { authorization: 'Bearer t' } });
    const next = vi.fn();

    await authenticate(req, mockRes(), next);

    expect(next).toHaveBeenCalled();
  });

  it('rejects a blacklisted jti with "Token has been revoked"', async () => {
    const blacklist = makeBlacklist(true);
    const authenticate = createAuthenticate({
      jwtSecret: 'test-secret',
      blacklist,
    });
    const req = mockReq({ headers: { authorization: 'Bearer t' } });
    const next = vi.fn();

    await expect(authenticate(req, mockRes(), next)).rejects.toThrow(
      'Token has been revoked'
    );
    expect(blacklist.isBlacklisted).toHaveBeenCalledWith('jti-abc');
    expect(next).not.toHaveBeenCalled();
  });

  it('passes through when jti is not blacklisted', async () => {
    const blacklist = makeBlacklist(false);
    const authenticate = createAuthenticate({
      jwtSecret: 'test-secret',
      blacklist,
    });
    const req = mockReq({ headers: { authorization: 'Bearer t' } });
    const next = vi.fn();

    await authenticate(req, mockRes(), next);

    expect(blacklist.isBlacklisted).toHaveBeenCalledWith('jti-abc');
    expect(next).toHaveBeenCalled();
  });

  it('skips blacklist check when token has no jti (legacy token)', async () => {
    // Legacy token issued before Step 2 had no jti claim.
    vi.mocked(jwt.verify).mockReturnValueOnce({
      id: 'legacy-user',
      role: 'customer',
    } as any);
    const blacklist = makeBlacklist(true); // would reject if checked
    const authenticate = createAuthenticate({
      jwtSecret: 'test-secret',
      blacklist,
    });
    const req = mockReq({ headers: { authorization: 'Bearer legacy' } });
    const next = vi.fn();

    await authenticate(req, mockRes(), next);

    expect(blacklist.isBlacklisted).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});

// ─── authorize ─────────────────────────────────────────
describe('authorize', () => {
  it('calls next when user role is in the allowed list', () => {
    const middleware = authorize('admin', 'customer');
    const req = mockReq({ user: { id: 'u1', role: 'customer' } });
    const next = vi.fn();

    middleware(req, mockRes(), next);

    expect(next).toHaveBeenCalled();
  });

  it('throws ForbiddenError when user role is not allowed', () => {
    const middleware = authorize('admin');
    const req = mockReq({ user: { id: 'u1', role: 'customer' } });

    expect(() => middleware(req, mockRes(), vi.fn())).toThrow(
      'Role (customer) is not allowed to access this resource'
    );
  });

  it('throws ForbiddenError when req.user is missing', () => {
    const middleware = authorize('admin');
    const req = mockReq();

    expect(() => middleware(req, mockRes(), vi.fn())).toThrow();
  });
});
