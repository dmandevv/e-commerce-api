// ─── Integration Tests: Order Service API ───────────────
// All routes require auth. The controller delegates to orderService,
// so we mock the service layer (not Prisma directly).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// ─── Hoist mocks ────────────────────────────────────────
const mockOrderService = vi.hoisted(() => ({
  placeOrder: vi.fn(),
  getOrderById: vi.fn(),
  getUserOrders: vi.fn(),
  updateOrderStatus: vi.fn(),
}));

// ─── Mock orderService ──────────────────────────────────
vi.mock('./services/orderService.js', () => mockOrderService);

// ─── Mock config ────────────────────────────────────────
vi.mock('./config/index.js', () => ({
  config: {
    port: 3004,
    databaseUrl: 'postgresql://test',
    jwtSecret: 'test-secret-key',
    rabbitmqUrl: 'amqp://test',
    productServiceUrl: 'http://product-service:3002',
    cartServiceUrl: 'http://cart-service:3003',
  },
}));

// ─── Mock swagger ───────────────────────────────────────
vi.mock('./swagger.js', () => ({ default: {} }));

// ─── Import app AFTER mocks ─────────────────────────────
import { app } from './app.js';
import { z, ORDER_STATUSES, NotFoundError } from '@ecommerce/shared';

// ─── Constants & Helpers ────────────────────────────────
const JWT_SECRET = 'test-secret-key';

const createToken = (id: string, role: string = 'customer') =>
  jwt.sign({ id, role }, JWT_SECRET, { expiresIn: '1d' });

const customerToken = createToken('user1', 'customer');
const adminToken = createToken('admin1', 'admin');

// Fake order — what orderService returns
const fakeOrder = {
  id: 'order1',
  userId: 'user1',
  items: [{ productId: 'prod1', name: 'Headphones', price: 299.99, quantity: 1 }],
  total: 299.99,
  status: 'PENDING',
  createdAt: '2026-01-01T00:00:00.000Z',
};

// ─── Reset mocks ────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────
// POST /api/orders (place order)
// ─────────────────────────────────────────────────────────
describe('POST /api/orders', () => {
  // place order successfully
  it('should place order and return 201', async () => {
    mockOrderService.placeOrder.mockResolvedValue(fakeOrder);

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('order1');
    // placeOrder receives: (userId, token, requestId)
    expect(mockOrderService.placeOrder).toHaveBeenCalledWith(
      'user1',
      customerToken,
      expect.any(String), // requestId (generated UUID)
    );
  });

  // no token (401)
  it('should reject when token is missing and return 401', async () => {
    const res = await request(app)
      .post('/api/orders')

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Login first to access this resource');
  });
});

// ─────────────────────────────────────────────────────────
// GET /api/orders/mine (get user's orders)
// ─────────────────────────────────────────────────────────
describe('GET /api/orders/mine', () => {
  // returns user's orders (200)
  it('should get all orders for user and return 200', async () => {
    mockOrderService.getUserOrders.mockResolvedValue([fakeOrder]);

    const res = await request(app)
      .get('/api/orders/mine')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('order1');
    expect(mockOrderService.getUserOrders).toHaveBeenCalledWith('user1');
  });
  // no token (401)
  it('should get reject when token is missing and return 401', async () => {
    const res = await request(app)
      .get('/api/orders')

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Login first to access this resource');
  });
});

// ─────────────────────────────────────────────────────────
// GET /api/orders/:id (get single order)
// ─────────────────────────────────────────────────────────
describe('GET /api/orders/:id', () => {
  // returns order (200)
  it('should get single order with id for user and return 200', async () => {
    mockOrderService.getOrderById.mockResolvedValue(fakeOrder);

    const res = await request(app)
      .get('/api/orders/order1')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PENDING');
    expect(mockOrderService.getOrderById).toHaveBeenCalledWith('order1', 'user1');
  });

  // order not found (404)
  it('should return 404 if order not found', async () => {
    mockOrderService.getOrderById.mockRejectedValue(new NotFoundError('Order'));

    const res = await request(app)
      .get('/api/orders/fakeOrderId')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Order not found');
    expect(mockOrderService.getOrderById).toHaveBeenCalledWith('fakeOrderId', 'user1');
  });
});

// ─────────────────────────────────────────────────────────
// PATCH /api/orders/:id/status (admin only — update status)
// ─────────────────────────────────────────────────────────
describe('PATCH /api/orders/:id/status', () => {
  // admin updates status (200)
  it('should update status of order and return 200', async () => {
    mockOrderService.updateOrderStatus.mockResolvedValue({ ...fakeOrder, status: 'SHIPPED' });

    const res = await request(app)
      .patch('/api/orders/order1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'SHIPPED' });

    expect(res.status).toBe(200);
    expect(mockOrderService.updateOrderStatus).toHaveBeenCalledWith('order1', 'SHIPPED');
    expect(res.body.data.status).toBe('SHIPPED');
  });

  // invalid status (400 — Zod rejects it)
  it('should update status of order and return 200', async () => {

    const res = await request(app)
      .patch('/api/orders/order1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'INVALID' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([{ 
        field: 'status',
        message: `Status must be one of: ${ORDER_STATUSES.join(', ')}` 
      }])
    );
  });

  // customer cannot update status (403)
  it('should reject customer\'s trying to update order status and return 403', async () => {

    const res = await request(app)
      .patch('/api/orders/order1/status')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ status: 'PAID' });

    expect(res.status).toBe(403);
  });
});
