// ─── Integration Tests: User Service API ────────────────
// These test the full HTTP request → response cycle through Express.
// Supertest sends real HTTP requests to our app. We mock Mongoose
// (no real MongoDB) but everything else runs for real: middleware,
// validation, error handling, JWT signing/verification.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// ─── Hoist mocks (created before any imports run) ───────
// We need to mock the User model so no real MongoDB calls happen.
// vi.hoisted() ensures these exist before vi.mock() factories execute.
const mockUser = vi.hoisted(() => ({
  findOne: vi.fn(),   // Used by login (find by email) and register (check duplicate)
  findById: vi.fn(),  // Used by getProfile and getUserById
  create: vi.fn(),    // Used by register (create new user)
  findByIdAndUpdate: vi.fn(),
}));

// ─── Mock the User model ────────────────────────────────
// Replace the real Mongoose model with our mock object.
// Every call to User.findOne(), User.create(), etc. goes through our mocks.
vi.mock('./models/User.js', () => ({
  User: mockUser,
}));

// ─── Mock the Refresh token model ────────────────────────────────
vi.mock('./models/RefreshToken.js', () => ({
  RefreshToken: {
    updateMany: vi.fn(),
  },
}));


// ─── Mock Tokens ────────────────────────────────
// Refresh tokens are stored in mongoDB
vi.mock('./lib/tokens.js', () => ({
  signAccessToken: vi.fn(() => 'fake-access-token'),
  issueRefreshToken: vi.fn(async () => 'fake-refresh-token'),
  rotateRefreshToken: vi.fn(),
  revokeFamily: vi.fn(),
}));

// ─── Mock verificationToken helpers ─────────────────────
// createVerificationToken returns the raw token (used in email link).
// consumeVerificationToken returns userId on success, null on bad token.
vi.mock('./lib/verificationToken.js', () => ({
  createVerificationToken: vi.fn(async () => 'fake-raw-token'),
  consumeVerificationToken: vi.fn(),
}));

// ─── Mock config ────────────────────────────────────────
// Provide a known JWT secret so we can create valid tokens in tests.
vi.mock('./config/index.js', () => ({
  config: {
    port: 3001,
    mongoUri: 'mongodb://test',
    jwtSecret: 'test-secret-key',
    accessTokenExpiresIn: '15m',
    refreshTokenExpiresInDays: 7,
    cookieSecure: false,
    cookieDomain: '',
    rabbitmqUrl: 'amqp://test',
    clientUrl: 'http://localhost:3000',
    maxLoginAttempts: 3,
    lockoutDurationMinutes: 15,
  },
}));

// ─── Mock swagger (avoid loading the real spec) ─────────
vi.mock('./swagger.js', () => ({ default: {} }));

// ─── Mock blacklist (no real Redis connection) ──────────
// Auth middleware checks the blacklist on every request. We return `false`
// so all tokens pass the revocation gate; individual tests that want to
// exercise the revoked-token path override this per call.
// Hoisted so tests can reference mockBlacklist.blacklistToken directly.
const mockBlacklist = vi.hoisted(() => ({
  isBlacklisted: vi.fn().mockResolvedValue(false),
  blacklistToken: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./lib/blacklist.js', () => ({
  blacklist: mockBlacklist,
}));

// ─── Mock RabbitMQ (no real publisher/consumer) ──────────
vi.mock('./events/publisher.js', () => ({
  publishEvent: vi.fn(),
  connectRabbitMQ: vi.fn(),
}));


// ─── Import app AFTER mocks are set up ──────────────────
// This is why we use vi.mock() — it hoists above imports automatically.
// The app gets our mocked User model and config, not the real ones.
import { app } from './app.js';
import { consumeVerificationToken, createVerificationToken } from './lib/verificationToken.js';
import { requestVerificationEmail, verifyEmail } from './controllers/userController.js';
import { ValidationError } from '@ecommerce/shared';
import { create } from 'node:domain';
import { RefreshToken } from './models/RefreshToken.js';

// ─── Test JWT secret (must match the mock config above) ─
const JWT_SECRET = 'test-secret-key';

// ─── Helper: create a valid JWT for protected route tests ─
// This mimics what the real signToken() does in userController.
const createToken = (id: string, role: string = 'customer') => {
  return jwt.sign({ id, role }, JWT_SECRET, { expiresIn: '1d' });
};

// ─── Helper: attach CSRF cookie + matching header ──────
// The csrfProtection middleware (shared package) runs before routes,
// so every mutating request (POST/PUT/PATCH/DELETE) needs both.
const withCsrf = (req: request.Test, extraCookies: string[] = []): request.Test =>
  req
    .set('Cookie', ['csrfToken=test-csrf', ...extraCookies])
    .set('X-CSRF-Token', 'test-csrf');

// ─── Helper: fake user document ─────────────────────────
// Simulates what Mongoose returns from User.findOne() or User.create().
// Includes the comparePassword method that the login flow calls.
const fakeUser = {
  _id: { toString: () => 'user123' },
  name: 'Test User',
  email: 'test@example.com',
  password: 'hashedpassword',
  role: 'customer' as const,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  failedLoginAttempts: 0,
  lockedUntil: undefined as Date | undefined,
  emailVerified: true,
  comparePassword: vi.fn(),
  save: vi.fn(),
};

// ─── Reset all mocks before each test ───────────────────
beforeEach(() => {
  vi.clearAllMocks();
  fakeUser.failedLoginAttempts = 0;
  fakeUser.lockedUntil = undefined;
  fakeUser.emailVerified = true;
});

// ─────────────────────────────────────────────────────────
// POST /api/users/register
// ─────────────────────────────────────────────────────────
describe('POST /api/users/register', () => {
  // Test 1: Successful registration
  it('should register a new user and return 201 with user info', async () => {
    // No existing user with this email
    mockUser.findOne.mockResolvedValue(null);
    // User.create returns our fake user
    mockUser.create.mockResolvedValue(fakeUser);

    const res = await withCsrf(request(app)
      .post('/api/users/register'))  
      .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });

    // Verify the response
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Check cookies are set (Set-Cookie is an array of cookie strings)
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('accessToken='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);

    // Verify User.create was called with the right data.
    // emailVerified is true in test because NODE_ENV !== 'production'.
    expect(mockUser.create).toHaveBeenCalledWith({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'customer',
      emailVerified: true,
    });
  });

  // Test 2: Duplicate email
  it('should NOT register a new user with an email linked to exisitng account and return 409 error', async () => {
    // Existing user with this email
    mockUser.findOne.mockResolvedValue(fakeUser);
    
    const res = await withCsrf(request(app)
      .post('/api/users/register')
      .send({ name: 'Test User', email: 'test@example.com', password: 'password123' }));

    // Verify the response
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("User already exists");

    // Verify User.findOne was called with the right data
    expect(mockUser.findOne).toHaveBeenCalledWith({
      email: 'test@example.com',
    });

    // Defensive check
    expect(mockUser.create).not.toHaveBeenCalled();
  });

  // Test 3: Invalid body — missing required fields
  it("should not accept invalid data and reject with 400 error", async () => {   
    const res = await withCsrf(request(app)
      .post('/api/users/register')
      .send({ }));
    // Verify the response
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      errors: [
        { field: "name", message: "Invalid input: expected string, received undefined" },
        { field: "email", message: "Please provide a valid email" },
        { field: "password", message: "Invalid input: expected string, received undefined" },
      ]
    });
    expect(mockUser.findOne).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────
// POST /api/users/login
// ─────────────────────────────────────────────────────────
describe('POST /api/users/login', () => {
  // Test 1: Successful login (200 + cookie + user)
  it("should return token and user data with a 200 status", async () => {
    mockUser.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(fakeUser) });
    fakeUser.comparePassword.mockResolvedValue(true);

   const res = await withCsrf(request(app)
      .post('/api/users/login')
      .send({ email: "test@example.com", password: "hashedpassword" }));

    // Verify the response
    expect(res.status).toBe(200);

    // Check cookies are set (Set-Cookie is an array of cookie strings)
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('accessToken='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
        
    expect(res.body.data.user).toEqual({
      id: "user123",
      name: "Test User",
      email: "test@example.com",
      role: "customer",
    });
    // Check findOne was called with the email
    expect(mockUser.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    // Grab the select mock from what findOne returned, and check it was called with '+password'
    const selectMock = mockUser.findOne.mock.results[0].value.select;
    expect(selectMock).toHaveBeenCalledWith('+password');
  });
  // Test 2: Wrong password (401)
  it("should reject incorrect passwords and return status 401", async () => {
    mockUser.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(fakeUser) });
    fakeUser.comparePassword.mockResolvedValue(false);
    const res = await withCsrf(request(app)
      .post('/api/users/login')
      .send({ email: "test@example.com", password: "wronghashedpassword" }));
    // Verify the response
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Invalid credentials");
    // Check findOne was called with the email
    expect(mockUser.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    // Grab the select mock from what findOne returned, and check it was called with '+password'
    const selectMock = mockUser.findOne.mock.results[0].value.select;
    expect(selectMock).toHaveBeenCalledWith('+password');
    expect(fakeUser.comparePassword).toHaveBeenCalledWith("wronghashedpassword");
  });
  // Test 3: Non-existent email (401)
  it("should reject non-existent emails and return 401", async () => {
    mockUser.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });
    const res = await withCsrf(request(app)
      .post('/api/users/login')
      .send({ email: "fake_email@example.com", password: "hashedpassword" }));
    // Check findOne was called with the email
    expect(mockUser.findOne).toHaveBeenCalledWith({ email: 'fake_email@example.com' });
    // Grab the select mock from what findOne returned, and check it was called with '+password'
    const selectMock = mockUser.findOne.mock.results[0].value.select;
    expect(selectMock).toHaveBeenCalledWith('+password');
    // Verify the response
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Invalid credentials");
  });
  it("should increment failedLoginAttempts on failed login (wrong password)", async () => {
    mockUser.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(fakeUser) });
    fakeUser.comparePassword.mockResolvedValue(false);
    const res = await withCsrf(request(app)
      .post('/api/users/login')
      .send({ email: "test@example.com", password: "wrongpassword" }));
    
    expect(fakeUser.failedLoginAttempts).toBe(1);
    expect(fakeUser.lockedUntil).toBe(undefined);
    expect(fakeUser.save).toHaveBeenCalled();
  });
  it('should lock account upon reaching max login attempts', async () => {
    mockUser.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(fakeUser) });
    fakeUser.comparePassword.mockResolvedValue(false);
    fakeUser.failedLoginAttempts = 2;
    const res = await withCsrf(request(app)
      .post('/api/users/login')
      .send({ email: "test@example.com", password: "wrongpassword" }));
    
    expect(fakeUser.failedLoginAttempts).toBe(3);
    expect(fakeUser.lockedUntil).toBeInstanceOf(Date);
    expect(fakeUser.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    expect(fakeUser.save).toHaveBeenCalled();   
  });
  it('should reject when account is locked', async () => {
    mockUser.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(fakeUser) });
    fakeUser.lockedUntil = new Date(Date.now() + 1_000_000);
    const res = await withCsrf(request(app)
      .post('/api/users/login')
      .send({ email: "test@example.com", password: "hashedpassword" }));
    
    expect(fakeUser.lockedUntil).toBeInstanceOf(Date);
    expect(fakeUser.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    expect(fakeUser.save).not.toHaveBeenCalled();   
  });
  it('should reset failedLoginAttempts and lockedUntil on successful login', async () => {
    mockUser.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(fakeUser) });
    fakeUser.comparePassword.mockResolvedValue(true);
    fakeUser.failedLoginAttempts = 3;
    fakeUser.lockedUntil = new Date(Date.now() - 1_000);
    const res = await withCsrf(request(app)
      .post('/api/users/login')
      .send({ email: "test@example.com", password: "hashedpassword" }));
    
    expect(fakeUser.failedLoginAttempts).toBe(0);
    expect(fakeUser.lockedUntil).toBeUndefined();
    expect(fakeUser.save).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────
// POST /api/users/refresh
// ─────────────────────────────────────────────────────────
describe('POST /api/users/refresh', () => {

  it("should return 401 when refresh token is missing", async () => {
    const res = await withCsrf(request(app).post('/api/users/refresh'));
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('No refresh token provided');
  });

  it("should return 401 when refresh token is invalid", async () => {
    const { rotateRefreshToken } = await import('./lib/tokens.js');
    vi.mocked(rotateRefreshToken).mockResolvedValueOnce(null);

    const res = await withCsrf(request(app)
      .post('/api/users/refresh'), ['refreshToken=badToken']);
    
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid or expired refresh token');

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('accessToken=') && c.includes('Expires='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refreshToken=') && c.includes('Expires='))).toBe(true);
  });

  it("should issue new access and refresh token cookies on successful rotation", async () => {
    const { rotateRefreshToken } = await import('./lib/tokens.js');
    vi.mocked(rotateRefreshToken).mockResolvedValueOnce({ userId: 'user123', newToken: 'token123' });
    mockUser.findById.mockResolvedValue(fakeUser);

    const res = await withCsrf(request(app)
      .post('/api/users/refresh'), ['refreshToken=old-valid-token']);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('accessToken='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
  });

  it("should return 401 if user no longer exists", async () => {
    const { rotateRefreshToken } = await import('./lib/tokens.js');
    vi.mocked(rotateRefreshToken).mockResolvedValueOnce({ userId: 'deletedUserId', newToken: 'token123' });
    mockUser.findById.mockResolvedValue(null);

    const res = await withCsrf(request(app)
      .post('/api/users/refresh'), ['refreshToken=orphaned-token']);
    
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('User not found');
  });
});

// ─────────────────────────────────────────────────────────
// POST /api/users/logout
// ─────────────────────────────────────────────────────────
describe('POST /api/users/logout', () => {
  it("should revoke family and clear cookies when a refresh token is present", async () => {
    const { revokeFamily } = await import('./lib/tokens.js');

    const res = await withCsrf(request(app)
      .post('/api/users/logout'), ['refreshToken=some-valid-token']);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(revokeFamily).toHaveBeenCalledWith('some-valid-token');

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('accessToken=') && c.includes('Expires='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refreshToken=') && c.includes('Expires='))).toBe(true);
  });

  it("should succeed and clear cookies even when no refresh token is present", async () => {
    const { revokeFamily } = await import('./lib/tokens.js');

    const res = await withCsrf(request(app)
      .post('/api/users/logout'));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // revokeFamily should NOT be called when there's no cookie
    expect(revokeFamily).not.toHaveBeenCalled();

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('accessToken=') && c.includes('Expires='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refreshToken=') && c.includes('Expires='))).toBe(true);
  });

  it("should blacklist the access token jti when a valid accessToken is present", async () => {
    // Sign a real JWT with a known jti so we can assert blacklistToken receives it.
    const validToken = jwt.sign(
      { id: 'u1', role: 'customer', jti: 'jti-to-revoke' },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const res = await withCsrf(
      request(app).post('/api/users/logout'),
      [`accessToken=${validToken}`]
    );

    expect(res.status).toBe(200);
    // The jti from the cookie should have been passed to blacklistToken,
    // with a positive TTL (remaining token lifetime in seconds).
    expect(mockBlacklist.blacklistToken).toHaveBeenCalledWith(
      'jti-to-revoke',
      expect.any(Number),
    );
    const [, ttl] = mockBlacklist.blacklistToken.mock.calls[0];
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(900); // 15m max
  });

  it("should still clear cookies when blacklist write fails (Redis down)", async () => {
    // Simulate Redis being unreachable.
    mockBlacklist.blacklistToken.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const validToken = jwt.sign(
      { id: 'u1', role: 'customer', jti: 'jti-x' },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const res = await withCsrf(
      request(app).post('/api/users/logout'),
      [`accessToken=${validToken}`]
    );

    // Logout still succeeds — cookie UX shouldn't break over a Redis blip.
    // The blacklist write failure is logged but swallowed so the user still
    // sees "logged out" in the UI.
    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('accessToken=') && c.includes('Expires='))).toBe(true);
  });
});



// ─────────────────────────────────────────────────────────
// GET /api/users/profile
// ─────────────────────────────────────────────────────────
describe('GET /api/users/profile', () => {
  // Test 1: Success with valid token (200)
  it("should return valid token for logged in user with status 200", async () => {
    mockUser.findById.mockResolvedValue(fakeUser);
    const token = createToken("user123");
    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
    expect(mockUser.findById).toHaveBeenCalledWith("user123");  
    // Verify the response
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('test@example.com');
  });
  it("should return 401 status if token is missing", async () => {
    const res = await request(app)
      .get('/api/users/profile')
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Login first to access this resource');
    expect(mockUser.findById).not.toHaveBeenCalled();
  });
  // Test 3: Invalid token (401)
  it("should reject an invalid token and return status 401", async () => {
    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer invalidtoken`)
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid or expired token');
  });

});

// ─────────────────────────────────────────────────────────
// GET /api/users/internal/:id
// ─────────────────────────────────────────────────────────
describe('GET /api/users/internal/:id', () => {
  // Test 1: Success (200)
  it("should return user info without needing authentication with status 200", async () => {
    mockUser.findById.mockResolvedValue(fakeUser);
    const res = await request(app)
      .get('/api/users/internal/user123')
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Test User");
  });
  // Test 2: Not found (404)
  it("should return 404 error if no user with that id exists", async () => {
    mockUser.findById.mockResolvedValue(null);
    const res = await request(app)
      .get('/api/users/internal/fakeUserId')
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("User not found");
  });
});

// ─────────────────────────────────────────────────────────
// GET /api/users/csrf (bootstrap endpoint — issues CSRF cookie)
// ─────────────────────────────────────────────────────────
describe('GET /api/users/csrf', () => {
  it('should issue a csrfToken cookie and return 204', async () => {
    const res = await request(app).get('/api/users/csrf');

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});

    // Cookie must be set so the frontend can read it
    const cookies = res.headers['set-cookie'] as unknown as string[];
    const csrfCookie = cookies.find((c) => c.startsWith('csrfToken='));
    expect(csrfCookie).toBeDefined();

    //httpOnly must be false so frontend JS can read via document.cookie
    expect(csrfCookie).not.toMatch(/httpOnly/i);
    //same site
    expect(csrfCookie).toMatch(/sameSite=lax/i);
    // Path=/ so it's sent with every same-origin request
    expect(csrfCookie).toMatch(/Path=\//);
  });
});

// ─────────────────────────────────────────────────────────
// GET /api/users/verify-email/:token
// ─────────────────────────────────────────────────────────
describe('GET /api/users/verify-email/:token', () => {
  it('should verify email and return 200 if token is valid', async () => {
    vi.mocked(consumeVerificationToken).mockResolvedValueOnce('user123');
    const res = await request(app)
      .get('/api/users/verify-email/valid-raw-token');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockUser.findByIdAndUpdate).toHaveBeenCalled();
  });
  it('should return 400 when token is invalid or expired', async () => {
    vi.mocked(consumeVerificationToken).mockResolvedValueOnce(null);
    const res = await request(app)
      .get('/api/users/verify-email/invalid-token');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid or expired verification link');
  });
});

// ─────────────────────────────────────────────────────────
// POST /api/users/verify-email/request
// ─────────────────────────────────────────────────────────
describe('POST /api/users/verify-email/request', () => {
  it('should send verification email and return 204', async () => {
    fakeUser.emailVerified = false;
    mockUser.findById.mockResolvedValue(fakeUser);
    const token = createToken('user123');

    const res = await withCsrf(
      request(app)
        .post('/api/users/verify-email/request'),
      [`accessToken=${token}`]
    );

    expect(res.status).toBe(204);
    expect(createVerificationToken).toHaveBeenCalledWith('user123', 'email-verification');
  });
  it('should return 401 when user is not authenticated', async () => {
    const res = await withCsrf(
      request(app).post('/api/users/verify-email/request')
    );

    expect(res.status).toBe(401);
  });
  it('should return 404 when user does not exist', async () => {
    mockUser.findById.mockResolvedValue(null);
    const token = createToken('fake-user');

    const res = await withCsrf(
      request(app).post('/api/users/verify-email/request'),
      [`accessToken=${token}`]
    );

    expect(res.status).toBe(404);
    expect(createVerificationToken).not.toHaveBeenCalledWith();
  });
  it('should return 409 when user is already verified', async () => {
    mockUser.findById.mockResolvedValue(fakeUser);
    const token = createToken('user123');

    const res = await withCsrf(
      request(app).post('/api/users/verify-email/request'),
      [`accessToken=${token}`]
    );

    expect(res.status).toBe(409);
    expect(createVerificationToken).not.toHaveBeenCalledWith('user123', 'email-verification');
  }); 
});


// ─────────────────────────────────────────────────────────
// POST /api/users/forgot-password
// ─────────────────────────────────────────────────────────
describe('POST /api/users/forgot-password', () => {
  it('should create a reset token and return 200 if user with email exists', async () => {
    mockUser.findOne.mockResolvedValue(fakeUser);
    const token = createToken('user123');
    const res = await withCsrf(
      request(app)
        .post('/api/users/forgot-password')
        .send({ email: 'test@example.com' }),
      [`accessToken=${token}`]
    );
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('If an account with that email exists, a password reset link has been sent.');
    expect(createVerificationToken).toHaveBeenCalledWith('user123', 'password-reset');
  });
  it('should return 200 even if user with email does NOT exist', async () => {
    mockUser.findOne.mockResolvedValue(null);
    const token = createToken('unregisteredUser');
    const res = await withCsrf(
      request(app)
        .post('/api/users/forgot-password')
        .send({ email: 'unregistered@example.com' }),
      [`accessToken=${token}`]
    );
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('If an account with that email exists, a password reset link has been sent.');
    expect(createVerificationToken).not.toHaveBeenCalledWith();
  });
});

// ─────────────────────────────────────────────────────────
// POST /api/users/reset-password/:token
// ─────────────────────────────────────────────────────────
describe('POST /api/users/reset-password/:token', () => {
  it('should reset password and revoke all sessions when token is valid', async () => {
    vi.mocked(consumeVerificationToken).mockResolvedValueOnce('user123');
    mockUser.findById.mockResolvedValueOnce(fakeUser);
    const res = await withCsrf(
      request(app)
        .post('/api/users/reset-password/valid-token')
        .send({ password: 'new-password' })
    );
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Password reset successfully. Please log in with your new password.');
    expect(fakeUser.save).toHaveBeenCalled();
    expect(vi.mocked(RefreshToken.updateMany)).toHaveBeenCalled();
  });
  it('should return 400 if token is invalid or link has expired', async () => {
    vi.mocked(consumeVerificationToken).mockResolvedValueOnce(null);
    const res = await withCsrf(
      request(app)
        .post('/api/users/reset-password/invalid-token')
        .send({ password: 'new-password' })
    );
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid or expired reset link');
    expect(fakeUser.save).not.toHaveBeenCalled();
    expect(vi.mocked(RefreshToken.updateMany)).not.toHaveBeenCalled();
  });
  it('should return 404 if user not found after consuming token', async () => {
    vi.mocked(consumeVerificationToken).mockResolvedValueOnce('deletedUserId');
    mockUser.findById.mockResolvedValueOnce(null)
    const res = await withCsrf(
      request(app)
        .post('/api/users/reset-password/valid-token')
        .send({ password: 'new-password' })
    );
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('User not found');
    expect(fakeUser.save).not.toHaveBeenCalled();
    expect(vi.mocked(RefreshToken.updateMany)).not.toHaveBeenCalled();
  });
});