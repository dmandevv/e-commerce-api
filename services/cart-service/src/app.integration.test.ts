// ─── Integration Tests: Cart Service API ────────────────
// All cart routes require authentication. We mock the cartRepository
// (Redis layer) and global.fetch (product-service calls).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// ─── Hoist mocks ────────────────────────────────────────
const mockCartRepo = vi.hoisted(() => ({
  getCart: vi.fn(),
  addItem: vi.fn(),
  updateQuantity: vi.fn(),
  removeItem: vi.fn(),
  clearCart: vi.fn(),
  connect: vi.fn(),
}));

// ─── Mock cartRepository (no real Redis) ────────────────
vi.mock('./repositories/cartRepository.js', () => ({
  cartRepository: mockCartRepo,
}));

// ─── Mock config ────────────────────────────────────────
vi.mock('./config/index.js', () => ({
  config: {
    port: 3003,
    redisUrl: 'redis://test',
    jwtSecret: 'test-secret-key',
    rabbitmqUrl: 'amqp://test',
    cartTtl: 259200,
    productServiceUrl: 'http://product-service:3002',
  },
}));

// ─── Mock CircuitBreaker ────────────────────────────────
// The real CircuitBreaker wraps fetch calls. We replace it with a
// pass-through that just calls the function directly — no state tracking.
vi.mock('@ecommerce/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    CircuitBreaker: vi.fn(function() {
      return {
        fire: vi.fn((fn: () => Promise<unknown>) => fn()),
      };
    }),
  };
});

// ─── Mock swagger ───────────────────────────────────────
vi.mock('./swagger.js', () => ({ default: {} }));

// ─── Mock blacklist (no real Redis connection) ──────────
vi.mock('./lib/blacklist.js', () => ({
  blacklist: {
    isBlacklisted: vi.fn().mockResolvedValue(false),
    blacklistToken: vi.fn().mockResolvedValue(undefined),
  },
}));

// ─── Import app AFTER mocks ─────────────────────────────
import { app } from './app.js';

// ─── Constants & Helpers ────────────────────────────────
const JWT_SECRET = 'test-secret-key';

const createToken = (id: string, role: string = 'customer') =>
  jwt.sign({ id, role }, JWT_SECRET, { expiresIn: '1d' });

// Attach CSRF cookie + matching header for mutating requests.
// csrfProtection runs before routes, so every POST/PATCH/DELETE needs both.
const withCsrf = (req: request.Test, extraCookies: string[] = []): request.Test =>
  req
    .set('Cookie', ['csrfToken=test-csrf', ...extraCookies])
    .set('X-CSRF-Token', 'test-csrf');

const customerToken = createToken('user1', 'customer');

// Fake cart data — what cartRepository returns
const fakeCart = {
  userId: 'userId',
  items: [
    { productId: 'productId', name: 'name', price: 0, quantity: 0, image: 'image', variantId: 'v1' },
  ],
  total: 0,
};

// ─── Reset mocks ────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────
// GET /api/cart
// ─────────────────────────────────────────────────────────
describe('GET /api/cart', () => {
  // returns user's cart
  it('should return cart with 200', async () => {
    mockCartRepo.getCart.mockResolvedValue(fakeCart);

    const res = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].name).toBe('name');
    expect(mockCartRepo.getCart).toHaveBeenCalledWith('user1');
  });

  // no token (401)
  it('should return 401 when missing token', async () => {
    const res = await request(app)
      .get('/api/cart')

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Login first to access this resource');
  });
});

// ─────────────────────────────────────────────────────────
// POST /api/cart/items (add item — calls product-service)
// ─────────────────────────────────────────────────────────
describe('POST /api/cart/items', () => {
  // add item successfully
  it('should add item to cart with 200', async () => {
    // Mock fetch to simulate product-service response
    // The controller does: fetch(`${productServiceUrl}/api/products/${productId}`)
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { name: 'Test Headphones', price: 299.99, images: [{ url: 'https://cdn.test/img.jpg' }], variants: [{ id: 'v1', stock: 10, reservedStock: 0 }] },
      }),
    } as Response);

    mockCartRepo.addItem.mockResolvedValue(fakeCart);

    const res = await withCsrf(request(app).post('/api/cart/items'))
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: 'prod1', variantId: 'v1', quantity: 1 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockCartRepo.addItem).toHaveBeenCalledWith('user1', {
      productId: 'prod1',
      name: 'Test Headphones',
      price: 299.99,
      quantity: 1,
      image: 'https://cdn.test/img.jpg',
      variantId: 'v1',
    });
  });

  // product not found (404)
  it('should return 404 if item is not a real product', async () => {
    // Mock fetch to simulate product-service response
    // The controller does: fetch(`${productServiceUrl}/api/products/${productId}`)
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({
        data: { },
      }),
    } as Response);

    const res = await withCsrf(request(app).post('/api/cart/items'))
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: 'prod1', variantId: 'v1', quantity: 1 });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Product not found');
  });

  // out of stock (400)
  it('should return 400 when item stock is less than amount requested', async () => {
    // Mock fetch to simulate product-service response
    // The controller does: fetch(`${productServiceUrl}/api/products/${productId}`)
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { name: 'Test Headphones', price: 299.99, images: [{ url: 'https://cdn.test/img.jpg' }], variants: [{ id: 'v1', stock: 1, reservedStock: 0 }] },
      }),
    } as Response);

    const res = await withCsrf(request(app).post('/api/cart/items'))
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: 'prod1', variantId: 'v1', quantity: 10 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Only 1 items in stock');
  });

  // invalid body (400) — missing productId
  it('should return 400 when body params are missing', async () => {
    const res = await withCsrf(request(app).post('/api/cart/items'))
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining(
        {
          field: 'productId',
          message: "Invalid input: expected string, received undefined",
        }),
        expect.objectContaining(
        {
          field: 'variantId',
          message: "Invalid input: expected string, received undefined",
        }),
        expect.objectContaining({
          field: 'quantity',
          message: "Invalid input: expected number, received undefined",
        })
      ]),
    );
  });
});

// ─────────────────────────────────────────────────────────
// PATCH /api/cart/items/:productId (update quantity)
// ─────────────────────────────────────────────────────────
describe('PATCH /api/cart/items/:productId', () => {
  // update quantity (200)
  it("should update quantity for item already in cart and return 200", async () => {
    mockCartRepo.updateQuantity.mockResolvedValue(fakeCart);
    const res = await withCsrf(request(app).patch('/api/cart/items/productId'))
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ quantity: 1 });
    expect(res.status).toBe(200);
    expect(mockCartRepo.updateQuantity).toHaveBeenCalledWith('user1', 'productId', 1);
  });
});

// ─────────────────────────────────────────────────────────
// DELETE /api/cart/items/:productId (remove item)
// ─────────────────────────────────────────────────────────
describe('DELETE /api/cart/items/:productId', () => {
  // remove item (200)
  it("should remove item in cart and return 200", async () => {
    mockCartRepo.removeItem.mockResolvedValue({ ...fakeCart, items: [] });
    const res = await withCsrf(request(app).del('/api/cart/items/name'))
      .set('Authorization', `Bearer ${customerToken}`)
    expect(mockCartRepo.removeItem).toHaveBeenCalledWith('user1', 'name');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────
// DELETE /api/cart (clear cart)
// ─────────────────────────────────────────────────────────
describe('DELETE /api/cart', () => {
  // clear cart (200)
    it("should clear cart and return 200", async () => {
    mockCartRepo.clearCart.mockResolvedValue(undefined);
    const res = await withCsrf(request(app).del('/api/cart'))
      .set('Authorization', `Bearer ${customerToken}`)
    expect(mockCartRepo.clearCart).toHaveBeenCalledWith('user1');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Cart cleared');
  });
});
