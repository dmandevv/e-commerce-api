// ─── Integration Tests: Product Service API ─────────────
// Tests the full HTTP request → response cycle. Mocks the database
// layer (Product model), cache (Redis), and Cloudinary. Everything
// else runs for real: middleware, validation, auth, error handling.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// ─── Hoist mocks ────────────────────────────────────────
const mockProduct = vi.hoisted(() => ({
  find: vi.fn(),
  findById: vi.fn(),
  findByIdAndUpdate: vi.fn(),
  create: vi.fn(),
}));

const mockCache = vi.hoisted(() => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  cacheDel: vi.fn(),
  cacheDelPattern: vi.fn(),
}));

const mockCloudinary = vi.hoisted(() => ({
  uploadImage: vi.fn(),
  deleteImage: vi.fn(),
}));

// ─── Mock the Product model ─────────────────────────────
vi.mock('./models/Product.js', () => ({
  Product: mockProduct,
}));

// ─── Mock cache utils (no real Redis) ───────────────────
vi.mock('./utils/cache.js', () => mockCache);

// ─── Mock Cloudinary (no real uploads) ──────────────────
vi.mock('./utils/cloudinary.js', () => mockCloudinary);

// ─── Mock APIFeatures ───────────────────────────────────
// APIFeatures chains methods: new APIFeatures(query, queryStr).search().filter().sort().pagination()
// We mock it to return a controlled result without touching MongoDB.
const mockApiFeatures = vi.hoisted(() => {
  const instance = {
    search: vi.fn().mockReturnThis(),     // Returns itself for chaining
    filter: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    pagination: vi.fn().mockReturnThis(),
    query: [] as any[],                            // The "result" — set per test
    getPagination: vi.fn().mockResolvedValue({ page: 1, pages: 1, total: 0 }),
  };
  return { instance, APIFeatures: vi.fn(function() { return instance; }) };
});

vi.mock('./utils/apiFeatures.js', () => ({
  APIFeatures: mockApiFeatures.APIFeatures,
}));

// ─── Mock config ────────────────────────────────────────
vi.mock('./config/index.js', () => ({
  config: {
    port: 3002,
    mongoUri: 'mongodb://test',
    jwtSecret: 'test-secret-key',
    rabbitmqUrl: 'amqp://test',
    redisUrl: 'redis://test',
    cloudinary: {
      cloudName: 'test-cloud',
      apiKey: 'test-key',
      apiSecret: 'test-secret',
    },
  },
}));

// ─── Mock swagger ───────────────────────────────────────
vi.mock('./swagger.js', () => ({ default: {} }));

// ─── Import app AFTER mocks ─────────────────────────────
import { app } from './app.js';
import { cacheDel } from './utils/cache.js';

// ─── Constants ──────────────────────────────────────────
const JWT_SECRET = 'test-secret-key';

// ─── Helpers ────────────────────────────────────────────
const createToken = (id: string, role: string = 'customer') =>
  jwt.sign({ id, role }, JWT_SECRET, { expiresIn: '1d' });

// Attach CSRF cookie + matching header for mutating requests.
// csrfProtection runs before routes, so every POST/PATCH/DELETE needs both.
const withCsrf = (req: request.Test, extraCookies: string[] = []): request.Test =>
  req
    .set('Cookie', ['csrfToken=test-csrf', ...extraCookies])
    .set('X-CSRF-Token', 'test-csrf');

const adminToken = createToken('admin1', 'admin');
const customerToken = createToken('user1', 'customer');

// Fake product document — simulates what Mongoose returns
const fakeProduct = {
  _id: { toString: () => 'prod1' },
  name: 'Test Headphones',
  description: 'Noise cancelling headphones',
  price: 299.99,
  stock: 10,
  category: 'Electronics',
  images: [{ publicId: 'img1', url: 'https://cdn.test/img1.jpg' }],
  reviews: [] as { userId: string; name: string; rating: number; comment: string; _id: { toString: () => string } }[],
  numOfReviews: 0,
  rating: 0,
  createdBy: 'admin1',
  save: vi.fn(),
  deleteOne: vi.fn(),
};

// ─── Reset mocks before each test ───────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  // Default: cache miss so requests go through to the "database"
  mockCache.cacheGet.mockResolvedValue(null);
  mockCache.cacheSet.mockResolvedValue(undefined);
  mockCache.cacheDel.mockResolvedValue(undefined);
  mockCache.cacheDelPattern.mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────
// GET /api/products (public — list products)
// ─────────────────────────────────────────────────────────
describe('GET /api/products', () => {
  // returns product list from database (cache miss)
  it('should return product list from database with 200', async () => {
    // Set what the APIFeatures query "returns" from MongoDB
    mockApiFeatures.instance.query = [fakeProduct];
    mockApiFeatures.instance.getPagination.mockResolvedValue({
      page: 1, pages: 1, total: 1,
    });

    const res = await request(app).get('/api/products');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Test Headphones');
    expect(res.body.pagination.total).toBe(1);
    // Cache was checked and then set
    expect(mockCache.cacheGet).toHaveBeenCalled();
    expect(mockCache.cacheSet).toHaveBeenCalled();
  });

  // Test: returns cached product list on cache hit
  it('should return product list from cache with 200', async () => {
    // Set what the APIFeatures query "returns" from MongoDB
    mockApiFeatures.instance.query = [fakeProduct];
    mockApiFeatures.instance.getPagination.mockResolvedValue({
      page: 1, pages: 1, total: 1,
    });
    // Cache HIT — cacheGet returns data, so we skip MongoDB entirely
    mockCache.cacheGet.mockResolvedValue({
      data: [fakeProduct],
      pagination: { page: 1, pages: 1, total: 1 },
    });

    const res = await request(app).get('/api/products');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Test Headphones');
    expect(res.body.pagination.total).toBe(1);
    // Cache WAS checked, data WAS retrieved but NOT set
    expect(mockCache.cacheGet).toHaveBeenCalled();
    expect(mockCache.cacheSet).not.toHaveBeenCalled();
    expect(mockProduct.find).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────
// GET /api/products/:id (public — single product)
// ─────────────────────────────────────────────────────────
describe('GET /api/products/:id', () => {
  // returns a product by ID
  it('should return single product with 200', async () => {
    mockProduct.findById.mockResolvedValue(fakeProduct);

    const res = await request(app).get('/api/products/prod1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Test Headphones');
    expect(mockProduct.findById).toHaveBeenCalledWith('prod1');
    expect(mockCache.cacheSet).toHaveBeenCalled();
  });

  // product not found (404)
  it('should return with 404 for a non existent product', async () => {
    mockProduct.findById.mockResolvedValue(null);

    const res = await request(app).get('/api/products/fakeProduct');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Product not found")
    expect(mockProduct.findById).toHaveBeenCalledWith('fakeProduct');
  });
});

// ─────────────────────────────────────────────────────────
// POST /api/products (admin only — create product)
// ─────────────────────────────────────────────────────────
describe('POST /api/products', () => {
  const newProduct = {
    name: 'New Keyboard',
    description: 'Mechanical keyboard',
    price: 149.99,
    stock: 25,
    category: 'Electronics',
  };

  // admin creates product (201)
  it("should return 201 and the product created", async () => {
    mockProduct.create.mockResolvedValue({ ...fakeProduct, ...newProduct });
    const res = await withCsrf(request(app).post('/api/products'))
      .set('Authorization', `Bearer ${adminToken}`)
      .send(newProduct)
    expect(mockCache.cacheDelPattern).toHaveBeenCalledWith('list:*');
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  // customer cannot create product (403)
  it("should return 403 when customer tries to create product", async () => {
    const res = await withCsrf(request(app).post('/api/products'))
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ })
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Role (customer) is not allowed to access this resource')
  });

  // no token (401)
  it("should return 401 when token is missing", async () => {
    const res = await withCsrf(request(app).post('/api/products'))
      .send({ })
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Login first to access this resource')
  });
});

// ─────────────────────────────────────────────────────────
// PATCH /api/products/:id (admin only — update product)
// ─────────────────────────────────────────────────────────
describe('PATCH /api/products/:id', () => {
  // admin updates product (200)
  it("should return 200 and the updated product", async () => {
    mockProduct.findByIdAndUpdate.mockResolvedValue({ ...fakeProduct, price: 0.01 })
    const res = await withCsrf(request(app).patch('/api/products/prod1'))
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 0.01 })
    expect(mockCache.cacheDel).toHaveBeenCalledWith(`item:prod1`);
    expect(mockCache.cacheDelPattern).toHaveBeenCalledWith('list:*');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true)
    expect(res.body.data.price).toEqual(0.01);
  });

  // product not found (404)
  it("should return 404 when product not found", async () => {
    mockProduct.findByIdAndUpdate.mockResolvedValue(null)
    const res = await withCsrf(request(app).patch('/api/products/fakeProdId'))
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ })
    expect(res.status).toBe(404);
    expect(res.body.message).toEqual('Product not found');
  });
});

// ─────────────────────────────────────────────────────────
// DELETE /api/products/:id (admin only — delete product)
// ─────────────────────────────────────────────────────────
describe('DELETE /api/products/:id', () => {
  // admin deletes product (200)
  it("should return 200 when product is deleted", async () => {
    mockProduct.findById.mockResolvedValue(fakeProduct);
    const res = await withCsrf(request(app).del('/api/products/prod1'))
      .set('Authorization', `Bearer ${adminToken}`)
    expect(fakeProduct.deleteOne).toHaveBeenCalled();
    expect(mockCache.cacheDel).toHaveBeenCalledWith(`item:prod1`);
    expect(mockCache.cacheDelPattern).toHaveBeenCalledWith('list:*');
    expect(res.status).toBe(200);
    expect(res.body.message).toEqual('Product deleted');
  });

  // product not found (404)
  it("should return 404 when product not found", async () => {
    mockProduct.findById.mockResolvedValue(null);
    const res = await withCsrf(request(app).del('/api/products/fakeProdId'))
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404);
    expect(res.body.message).toEqual('Product not found');
  });
});

// ─────────────────────────────────────────────────────────
// POST /api/products/reviews (authenticated — create review)
// ─────────────────────────────────────────────────────────
describe('POST /api/products/reviews', () => {
  // customer creates review (200)
  it("should return 200 when review is created by customer", async () => {
  mockProduct.findById.mockResolvedValue({ ...fakeProduct, reviews: [], save: vi.fn() });
    const res = await withCsrf(request(app).post('/api/products/reviews'))
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ rating: 5, comment: 'It sucks', productId: 'prod1' })
    expect(mockCache.cacheDel).toHaveBeenCalledWith('item:prod1');
    expect(mockCache.cacheDelPattern).toHaveBeenCalledWith('list:*')
    expect(res.status).toBe(200);
    expect(res.body.data.reviews).toHaveLength(1);
    expect(res.body.data.reviews[0].rating).toBe(5);
  });
  // no token (401)
  it("should return 401 when token is missing", async () => {
    const res = await withCsrf(request(app).post('/api/products/reviews'))
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Login first to access this resource');
  });
});

// ─────────────────────────────────────────────────────────
// GET /api/products/:id/reviews (public)
// ─────────────────────────────────────────────────────────
describe('GET /api/products/:id/reviews', () => {
  const fakeReview = {
    userId: 'user1',
    name: 'Test User',
    rating: 5,
    comment: 'It sucks',
    _id: { toString: () => 'rev1' },
  };
  // returns reviews (200)
  it("should return 200 when requesting reviews of a specific product", async () => {
    mockProduct.findById.mockResolvedValue({ ...fakeProduct, reviews: [fakeReview], save: vi.fn() });
    const res = await request(app)
      .get('/api/products/prod1/reviews')
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].comment).toBe('It sucks');
    expect(res.body.data[0].rating).toBe(5);
  });
});
