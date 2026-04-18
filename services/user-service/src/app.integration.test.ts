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
}));

// ─── Mock the User model ────────────────────────────────
// Replace the real Mongoose model with our mock object.
// Every call to User.findOne(), User.create(), etc. goes through our mocks.
vi.mock('./models/User.js', () => ({
  User: mockUser,
}));

// ─── Mock Tokens ────────────────────────────────
// Refresh tokens are stored in mongoDB
vi.mock('./lib/tokens.js', () => ({
  signAccessToken: vi.fn(() => 'fake-access-token'),
  issueRefreshToken: vi.fn(async () => 'fake-refresh-token'),
  rotateRefreshToken: vi.fn(),
  revokeFamily: vi.fn(),
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

// ─── Import app AFTER mocks are set up ──────────────────
// This is why we use vi.mock() — it hoists above imports automatically.
// The app gets our mocked User model and config, not the real ones.
import { app } from './app.js';
import { mock } from 'node:test';
import { email } from 'zod';

// ─── Test JWT secret (must match the mock config above) ─
const JWT_SECRET = 'test-secret-key';

// ─── Helper: create a valid JWT for protected route tests ─
// This mimics what the real signToken() does in userController.
const createToken = (id: string, role: string = 'customer') => {
  return jwt.sign({ id, role }, JWT_SECRET, { expiresIn: '1d' });
};

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
  comparePassword: vi.fn(),
  save: vi.fn(),
};

// ─── Reset all mocks before each test ───────────────────
beforeEach(() => {
  vi.clearAllMocks();
  fakeUser.failedLoginAttempts = 0;
  fakeUser.lockedUntil = undefined;
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

    const res = await request(app)
      .post('/api/users/register')
      .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });

    // Verify the response
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Check cookies are set (Set-Cookie is an array of cookie strings)
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('accessToken='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);

    // Verify User.create was called with the right data
    expect(mockUser.create).toHaveBeenCalledWith({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'customer',
    });
  });

  // Test 2: Duplicate email
  it('should NOT register a new user with an email linked to exisitng account and return 409 error', async () => {
    // Existing user with this email
    mockUser.findOne.mockResolvedValue(fakeUser);
    
    const res = await request(app)
      .post('/api/users/register')
      .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });

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
    const res = await request(app)
      .post('/api/users/register')
      .send({ });
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

    const res = await request(app)
      .post('/api/users/login')
      .send({ email: "test@example.com", password: "hashedpassword" });

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
    const res = await request(app)
      .post('/api/users/login')
      .send({ email: "test@example.com", password: "wronghashedpassword" });
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
    const res = await request(app)
      .post('/api/users/login')
      .send({ email: "fake_email@example.com", password: "hashedpassword" });
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
    const res = await request(app)
      .post('/api/users/login')
      .send({ email: "test@example.com", password: "wrongpassword" });
    
    expect(fakeUser.failedLoginAttempts).toBe(1);
    expect(fakeUser.lockedUntil).toBe(undefined);
    expect(fakeUser.save).toHaveBeenCalled();
  });
  it('should lock account upon reaching max login attempts', async () => {
    mockUser.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(fakeUser) });
    fakeUser.comparePassword.mockResolvedValue(false);
    fakeUser.failedLoginAttempts = 2;
    const res = await request(app)
      .post('/api/users/login')
      .send({ email: "test@example.com", password: "wrongpassword" });
    
    expect(fakeUser.failedLoginAttempts).toBe(3);
    expect(fakeUser.lockedUntil).toBeInstanceOf(Date);
    expect(fakeUser.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    expect(fakeUser.save).toHaveBeenCalled();   
  });
  it('should reject when account is locked', async () => {
    mockUser.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(fakeUser) });
    fakeUser.lockedUntil = new Date(Date.now() + 1_000_000);
    const res = await request(app)
      .post('/api/users/login')
      .send({ email: "test@example.com", password: "hashedpassword" });
    
    expect(fakeUser.lockedUntil).toBeInstanceOf(Date);
    expect(fakeUser.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    expect(fakeUser.save).not.toHaveBeenCalled();   
  });
  it('should reset failedLoginAttempts and lockedUntil on successful login', async () => {
    mockUser.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(fakeUser) });
    fakeUser.comparePassword.mockResolvedValue(true);
    fakeUser.failedLoginAttempts = 3;
    fakeUser.lockedUntil = new Date(Date.now() - 1_000);
    const res = await request(app)
      .post('/api/users/login')
      .send({ email: "test@example.com", password: "hashedpassword" });
    
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
    const res = await request(app).post('/api/users/refresh');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('No refresh token provided');
  });

  it("should return 401 when refresh token is invalid", async () => {
    const { rotateRefreshToken } = await import('./lib/tokens.js');
    vi.mocked(rotateRefreshToken).mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/users/refresh')
      .set('Cookie', ['refreshToken=badToken']);
    
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

    const res = await request(app)
      .post('/api/users/refresh')
      .set('Cookie', ['refreshToken=old-valid-token']);
    
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

    const res = await request(app)
      .post('/api/users/refresh')
      .set('Cookie', ['refreshToken=orphaned-token']);
    
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

    const res = await request(app)
      .post('/api/users/logout')
      .set('Cookie', ['refreshToken=some-valid-token']);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(revokeFamily).toHaveBeenCalledWith('some-valid-token');

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('accessToken=') && c.includes('Expires='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refreshToken=') && c.includes('Expires='))).toBe(true);
  });

  it("should succeed and clear cookies even when no refresh token is present", async () => {
    const { revokeFamily } = await import('./lib/tokens.js');

    const res = await request(app).post('/api/users/logout');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // revokeFamily should NOT be called when there's no cookie
    expect(revokeFamily).not.toHaveBeenCalled();

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('accessToken=') && c.includes('Expires='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refreshToken=') && c.includes('Expires='))).toBe(true);
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