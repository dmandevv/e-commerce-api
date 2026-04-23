// ─── Integration Tests: Payment Service API ──────────────
// Tests REST routes + Stripe webhook endpoint.
// We mock the service layer (not Prisma/Stripe directly).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// ─── Hoist mocks ────────────────────────────────────────
const mockPaymentService = vi.hoisted(() => ({
  getPaymentByOrderId: vi.fn(),
  handleStripeWebhook: vi.fn(),
  createPaymentForOrder: vi.fn(),
}));

// ─── Mock paymentService ────────────────────────────────
vi.mock('./services/paymentService.js', () => mockPaymentService);

// ─── Mock config ────────────────────────────────────────
vi.mock('./config/index.js', () => ({
  config: {
    port: 3005,
    databaseUrl: 'postgresql://test',
    jwtSecret: 'test-secret-key',
    rabbitmqUrl: 'amqp://test',
    stripeSecretKey: 'sk_test_fake',       // fake Stripe key
    stripeWebhookSecret: '',               // empty = dev mode (skips signature check)
  },
}));

// ─── Mock swagger ───────────────────────────────────────
vi.mock('./swagger.js', () => ({ default: {} }));

// ─── Mock blacklist (no real Redis connection) ──────────
vi.mock('./lib/blacklist.js', () => ({
  blacklist: {
    isBlacklisted: vi.fn().mockResolvedValue(false),
    blacklistToken: vi.fn().mockResolvedValue(undefined),
  },
}));

// ─── Import app AFTER mocks ────────────────────────────
import { app } from './app.js';
import { NotFoundError } from '@ecommerce/shared';
import Stripe from 'stripe';

// ─── Constants & Helpers ────────────────────────────────
const JWT_SECRET = 'test-secret-key';

const createToken = (id: string, role: string = 'customer') =>
  jwt.sign({ id, role }, JWT_SECRET, { expiresIn: '1d' });

const customerToken = createToken('user1', 'customer');

// Fake payment — what paymentService returns
const fakePayment = {
  id: 'payment1',
  orderId: 'order1',
  userId: 'user1',
  amount: 299.99,
  status: 'PENDING',
  stripePaymentId: 'pi_test123',
  stripeClientSecret: 'pi_test123_secret_abc',
  createdAt: '2026-01-01T00:00:00.000Z',
};

// ─── Reset mocks ────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────
// GET /api/payments/:orderId
// ─────────────────────────────────────────────────────────
describe('GET /api/payments/:orderId', () => {
  // returns payment (200)
  it("should return payment and status 200", async () => {
    mockPaymentService.getPaymentByOrderId.mockResolvedValue(fakePayment);
    const res = await request(app)
        .get('/api/payments/order1')
        .set('Authorization', `Bearer ${customerToken}`);
    expect(mockPaymentService.getPaymentByOrderId).toHaveBeenCalledWith('order1', 'user1');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('payment1');
  });

  // payment not found (404)
  it("should return status 404 when no payment is found", async () => {
    mockPaymentService.getPaymentByOrderId.mockRejectedValue(new NotFoundError('Payment'));
    const res = await request(app)
        .get('/api/payments/fakeOrderId')
        .set('Authorization', `Bearer ${customerToken}`);
    expect(mockPaymentService.getPaymentByOrderId).toHaveBeenCalledWith('fakeOrderId', 'user1');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Payment not found');
  });
  // no token (401)
  it("should return status 401 when token is missing", async () => {
    const res = await request(app)
        .get('/api/payments/order1')
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Login first to access this resource');
  });
});

// ─────────────────────────────────────────────────────────
// POST /api/payments/webhook (Stripe webhook)
// ─────────────────────────────────────────────────────────
describe('POST /api/payments/webhook', () => {
  it("webhook processes event and returns 200", async () => {
    mockPaymentService.handleStripeWebhook.mockResolvedValue(undefined);
    const fakeEvent = { id: 'evt_test', type: 'payment_intent.succeeded', data: { object: {} } };
    const res = await request(app)
        .post('/api/payments/webhook')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(fakeEvent));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(mockPaymentService.handleStripeWebhook).toHaveBeenCalledWith(fakeEvent);
  });
});

// ─────────────────────────────────────────────────────────
// GET /health
// ─────────────────────────────────────────────────────────
describe('GET /health', () => {
  it("should return 200 ok", async () => {
    const res = await request(app)
        .get('/health');
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('payment-service');
  });
});
