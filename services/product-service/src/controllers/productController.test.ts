// Tests for the product controller: getProducts, getSingleProduct, createProduct,
// updateProduct, deleteProduct, createProductReview, getProductReviews,
// deleteReview, uploadProductImage, deleteProductImage.
//
// The controller is the "glue" layer — it coordinates between:
// - Product model (MongoDB via Mongoose)
// - Cache (Redis via cache utility)
// - Cloudinary (image CDN)
// - APIFeatures (search/filter/sort/pagination)
//
// We mock ALL external dependencies so we test only the controller logic:
// "Given this input, does it call the right things in the right order?"

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────
// All mock references created before vi.mock() runs (same vi.hoisted
// pattern as cache tests — prevents "Cannot access before initialization").

const {
  mockFind,
  mockFindById,
  mockCreate,
  mockFindByIdAndUpdate,
  mockCacheGet,
  mockCacheSet,
  mockCacheDel,
  mockCacheDelPattern,
  mockUploadImage,
  mockDeleteImage,
  mockConfig,
} = vi.hoisted(() => ({
  mockFind: vi.fn(),
  mockFindById: vi.fn(),
  mockCreate: vi.fn(),
  mockFindByIdAndUpdate: vi.fn(),
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
  mockCacheDel: vi.fn(),
  mockCacheDelPattern: vi.fn(),
  mockUploadImage: vi.fn(),
  mockDeleteImage: vi.fn(),
  mockConfig: {
    cloudinary: { cloudName: "test-cloud" },
  },
}));

// ─── Mock: Product model ──────────────────────────────────────────
vi.mock("../models/Product.js", () => ({
  Product: {
    find: mockFind,
    findById: mockFindById,
    create: mockCreate,
    findByIdAndUpdate: mockFindByIdAndUpdate,
  },
}));

// ─── Mock: APIFeatures ────────────────────────────────────────────
// APIFeatures is a class — we replace it with a factory that returns
// a chainable mock. The controller calls: new APIFeatures(query, queryStr)
//   .search().filter().sort().pagination(8)
// then reads .query for results and calls .getPagination() for page info.

// queryResult holds the value that `await apiFeatures.query` resolves to.
// The controller does `const products = await apiFeatures.query` — if .query
// is an array, `await [...]` returns the array itself. Each test sets this
// before calling the controller.
const queryResult: { value: any } = { value: [] };
const mockGetPagination = vi.fn();

vi.mock("../utils/apiFeatures.js", () => ({
  // Must use a regular function (not arrow function) because the controller
  // calls `new APIFeatures(...)`. Arrow functions can't be constructors —
  // they don't have their own `this`, so `new` throws "is not a constructor".
  APIFeatures: vi.fn().mockImplementation(function (this: any) {
    // .query is read by the controller with `await` — we set it to the test's
    // desired result. `await someArray` just returns the array (no-op await).
    this.query = queryResult.value;
    this.search = vi.fn().mockReturnValue(this);
    this.filter = vi.fn().mockReturnValue(this);
    this.sort = vi.fn().mockReturnValue(this);
    this.pagination = vi.fn().mockReturnValue(this);
    this.getPagination = mockGetPagination;
  }),
}));

// ─── Mock: Cache functions ────────────────────────────────────────
vi.mock("../utils/cache.js", () => ({
  cacheGet: mockCacheGet,
  cacheSet: mockCacheSet,
  cacheDel: mockCacheDel,
  cacheDelPattern: mockCacheDelPattern,
}));

// ─── Mock: Cloudinary functions ───────────────────────────────────
vi.mock("../utils/cloudinary.js", () => ({
  uploadImage: mockUploadImage,
  deleteImage: mockDeleteImage,
}));

// ─── Mock: Config ─────────────────────────────────────────────────
vi.mock("../config/index.js", () => ({
  config: mockConfig,
}));

// ─── Import controller AFTER all mocks are set up ─────────────────
import {
  getProducts,
  getSingleProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  createProductReview,
  getProductReviews,
  deleteReview,
  uploadProductImage,
  deleteProductImage,
} from "./productController.js";

// ─── Test helpers ─────────────────────────────────────────────────

// Creates a fake Express request object with common defaults.
// overrides lets each test customize only the parts it needs.
function mockReq(overrides: Record<string, unknown> = {}) {
  return {
    query: {},
    params: {},
    body: {},
    user: { id: "user123", role: "admin" },
    file: undefined,
    ...overrides,
  } as any;
}

// Creates a fake Express response with chainable status().json().
function mockRes() {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
  return res;
}

// Creates a fake product document returned by Mongoose findById.
// Includes methods like save(), deleteOne() that the controller calls.
function createMockProduct(overrides: Record<string, unknown> = {}) {
  return {
    _id: "prod123",
    name: "Test Product",
    description: "A test product",
    price: 29.99,
    category: "Electronics",
    stock: 10,
    images: [] as { publicId: string; url: string }[],
    reviews: [] as { userId: string; name: string; rating: number; comment: string }[],
    rating: 0,
    numOfReviews: 0,
    createdBy: "admin1",
    save: vi.fn(),
    deleteOne: vi.fn(),
    ...overrides,
  };
}

// ─── Reset all mocks between tests ────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════
// getProducts
// ═══════════════════════════════════════════════════════════════════

describe("getProducts", () => {
  it("should return cached data on cache hit", async () => {
    const req = mockReq({ query: { page: "1" } });
    const res = mockRes();

    // Cache hit — Redis has the data, skip MongoDB entirely
    const cachedData = {
      data: [{ name: "Cached Product" }],
      pagination: { page: 1, totalPages: 1 },
    };
    mockCacheGet.mockResolvedValue(cachedData);

    await getProducts(req, res);

    // Should build cache key from the query string
    expect(mockCacheGet).toHaveBeenCalledWith(
      `list:${JSON.stringify(req.query)}`
    );
    // Should return cached data without touching MongoDB
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      ...cachedData,
    });
  });

  it("should query MongoDB and cache result on cache miss", async () => {
    const req = mockReq({ query: { keyword: "phone" } });
    const res = mockRes();

    // Cache miss — Redis returns null
    mockCacheGet.mockResolvedValue(null);

    // Set the query result BEFORE calling the controller — the mock
    // constructor captures this value when `new APIFeatures()` runs.
    const products = [{ name: "Phone Case" }];
    queryResult.value = products;

    // getPagination returns page info
    const pagination = { page: 1, perPage: 8, totalCount: 1, totalPages: 1 };
    mockGetPagination.mockResolvedValue(pagination);

    await getProducts(req, res);

    // Should cache the result for next time
    expect(mockCacheSet).toHaveBeenCalledWith(
      `list:${JSON.stringify(req.query)}`,
      { data: products, pagination }
    );
    // Should return the MongoDB result
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: products,
      pagination,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// getSingleProduct
// ═══════════════════════════════════════════════════════════════════

describe("getSingleProduct", () => {
  it("should return cached product on cache hit", async () => {
    const req = mockReq({ params: { id: "prod123" } });
    const res = mockRes();

    const cachedProduct = { name: "Cached Product", price: 50 };
    mockCacheGet.mockResolvedValue(cachedProduct);

    await getSingleProduct(req, res);

    expect(mockCacheGet).toHaveBeenCalledWith("item:prod123");
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: cachedProduct,
    });
    // Should NOT query MongoDB when cache has the data
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it("should query MongoDB and cache on cache miss", async () => {
    const req = mockReq({ params: { id: "prod123" } });
    const res = mockRes();

    mockCacheGet.mockResolvedValue(null);
    const product = createMockProduct();
    mockFindById.mockResolvedValue(product);

    await getSingleProduct(req, res);

    expect(mockFindById).toHaveBeenCalledWith("prod123");
    expect(mockCacheSet).toHaveBeenCalledWith("item:prod123", product);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: product,
    });
  });

  it("should throw NotFoundError when product doesn't exist", async () => {
    const req = mockReq({ params: { id: "nonexistent" } });
    const res = mockRes();

    mockCacheGet.mockResolvedValue(null);
    mockFindById.mockResolvedValue(null);

    // The controller throws NotFoundError — the error handler middleware
    // catches it and sends the 404 response. We just verify the throw.
    await expect(getSingleProduct(req, res)).rejects.toThrow("Product not found");
  });
});

// ═══════════════════════════════════════════════════════════════════
// createProduct
// ═══════════════════════════════════════════════════════════════════

describe("createProduct", () => {
  it("should create product and invalidate list caches", async () => {
    const req = mockReq({
      body: { name: "New Product", price: 99 },
      user: { id: "admin1", role: "admin" },
    });
    const res = mockRes();

    const newProduct = createMockProduct({ name: "New Product", price: 99 });
    mockCreate.mockResolvedValue(newProduct);

    await createProduct(req, res);

    // Should stamp createdBy with the admin's ID
    expect(req.body.createdBy).toBe("admin1");
    // Should create the product in MongoDB
    expect(mockCreate).toHaveBeenCalledWith(req.body);
    // Should bust ALL listing caches — a new product could appear on any page
    expect(mockCacheDelPattern).toHaveBeenCalledWith("list:*");
    // Should return 201 Created (not 200)
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: newProduct,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// updateProduct
// ═══════════════════════════════════════════════════════════════════

describe("updateProduct", () => {
  it("should update product and invalidate caches", async () => {
    const req = mockReq({
      params: { id: "prod123" },
      body: { price: 79.99 },
    });
    const res = mockRes();

    const updatedProduct = createMockProduct({ price: 79.99 });
    mockFindByIdAndUpdate.mockResolvedValue(updatedProduct);

    await updateProduct(req, res);

    // findByIdAndUpdate with returnDocument: 'after' returns the UPDATED doc
    // runValidators: true re-runs Mongoose schema validation on the new values
    expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
      "prod123",
      { price: 79.99 },
      { returnDocument: "after", runValidators: true }
    );
    // Invalidate both the specific product cache AND all listing caches
    expect(mockCacheDel).toHaveBeenCalledWith("item:prod123");
    expect(mockCacheDelPattern).toHaveBeenCalledWith("list:*");
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: updatedProduct,
    });
  });

  it("should throw NotFoundError when product doesn't exist", async () => {
    const req = mockReq({ params: { id: "nonexistent" }, body: {} });
    const res = mockRes();

    mockFindByIdAndUpdate.mockResolvedValue(null);

    await expect(updateProduct(req, res)).rejects.toThrow("Product not found");
  });
});

// ═══════════════════════════════════════════════════════════════════
// deleteProduct
// ═══════════════════════════════════════════════════════════════════

describe("deleteProduct", () => {
  it("should delete product and invalidate caches", async () => {
    const req = mockReq({ params: { id: "prod123" } });
    const res = mockRes();

    const product = createMockProduct();
    mockFindById.mockResolvedValue(product);

    await deleteProduct(req, res);

    // First find the product (to confirm it exists), then delete it
    expect(mockFindById).toHaveBeenCalledWith("prod123");
    expect(product.deleteOne).toHaveBeenCalled();
    // Invalidate both caches
    expect(mockCacheDel).toHaveBeenCalledWith("item:prod123");
    expect(mockCacheDelPattern).toHaveBeenCalledWith("list:*");
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Product deleted",
    });
  });

  it("should throw NotFoundError when product doesn't exist", async () => {
    const req = mockReq({ params: { id: "nonexistent" } });
    const res = mockRes();

    mockFindById.mockResolvedValue(null);

    await expect(deleteProduct(req, res)).rejects.toThrow("Product not found");
  });
});

// ═══════════════════════════════════════════════════════════════════
// createProductReview
// ═══════════════════════════════════════════════════════════════════

describe("createProductReview", () => {
  it("should add a new review and recalculate rating", async () => {
    const req = mockReq({
      body: { productId: "prod123", rating: 4, comment: "Great!" },
      user: { id: "user456", role: "customer" },
    });
    const res = mockRes();

    // Product with no existing reviews
    const product = createMockProduct({ reviews: [] });
    mockFindById.mockResolvedValue(product);

    await createProductReview(req, res);

    // New review should be pushed to the array
    expect(product.reviews).toHaveLength(1);
    expect(product.reviews[0]).toMatchObject({
      userId: "user456",
      rating: 4,
      comment: "Great!",
    });
    // Rating should be recalculated: only 1 review, so rating = 4
    expect(product.rating).toBe(4);
    expect(product.numOfReviews).toBe(1);
    // Product should be saved with the new review
    expect(product.save).toHaveBeenCalled();
    // Caches invalidated — rating changed
    expect(mockCacheDel).toHaveBeenCalledWith("item:prod123");
    expect(mockCacheDelPattern).toHaveBeenCalledWith("list:*");
  });

  it("should update existing review instead of adding duplicate", async () => {
    const req = mockReq({
      body: { productId: "prod123", rating: 5, comment: "Even better!" },
      user: { id: "user456", role: "customer" },
    });
    const res = mockRes();

    // Product already has a review from this user
    const product = createMockProduct({
      reviews: [
        { userId: "user456", name: "John", rating: 3, comment: "OK" },
      ],
    });
    mockFindById.mockResolvedValue(product);

    await createProductReview(req, res);

    // Should still have 1 review (updated, not duplicated)
    expect(product.reviews).toHaveLength(1);
    // Rating should be updated from 3 to 5
    expect(product.reviews[0].rating).toBe(5);
    expect(product.reviews[0].comment).toBe("Even better!");
    expect(product.rating).toBe(5);
  });

  it("should calculate average rating across multiple reviews", async () => {
    const req = mockReq({
      body: { productId: "prod123", rating: 4 },
      user: { id: "user789", role: "customer" },
    });
    const res = mockRes();

    // Product already has one review (rating 2)
    const product = createMockProduct({
      reviews: [
        { userId: "user456", name: "Alice", rating: 2, comment: "Meh" },
      ],
    });
    mockFindById.mockResolvedValue(product);

    await createProductReview(req, res);

    // 2 reviews now: (2 + 4) / 2 = 3
    expect(product.reviews).toHaveLength(2);
    expect(product.rating).toBe(3);
    expect(product.numOfReviews).toBe(2);
  });

  it("should throw NotFoundError when product doesn't exist", async () => {
    const req = mockReq({ body: { productId: "nonexistent", rating: 5 } });
    const res = mockRes();

    mockFindById.mockResolvedValue(null);

    await expect(createProductReview(req, res)).rejects.toThrow(
      "Product not found"
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// getProductReviews
// ═══════════════════════════════════════════════════════════════════

describe("getProductReviews", () => {
  it("should return reviews for a product", async () => {
    const req = mockReq({ query: { productId: "prod123" } });
    const res = mockRes();

    const reviews = [
      { userId: "u1", name: "Alice", rating: 5, comment: "Love it" },
      { userId: "u2", name: "Bob", rating: 3, comment: "OK" },
    ];
    const product = createMockProduct({ reviews });
    mockFindById.mockResolvedValue(product);

    await getProductReviews(req, res);

    expect(mockFindById).toHaveBeenCalledWith("prod123");
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: reviews,
    });
  });

  it("should throw NotFoundError when product doesn't exist", async () => {
    const req = mockReq({ query: { productId: "nonexistent" } });
    const res = mockRes();

    mockFindById.mockResolvedValue(null);

    await expect(getProductReviews(req, res)).rejects.toThrow(
      "Product not found"
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// deleteReview
// ═══════════════════════════════════════════════════════════════════

describe("deleteReview", () => {
  it("should remove review and recalculate rating", async () => {
    const req = mockReq({
      query: { productId: "prod123", reviewId: "rev1" },
    });
    const res = mockRes();

    // Product has 2 reviews — we'll delete the one with _id "rev1"
    const product = createMockProduct({
      reviews: [
        { _id: { toString: () => "rev1" }, userId: "u1", rating: 2 },
        { _id: { toString: () => "rev2" }, userId: "u2", rating: 4 },
      ],
    });
    mockFindById.mockResolvedValue(product);

    await deleteReview(req, res);

    // Only the review with _id "rev2" should remain
    expect(product.reviews).toHaveLength(1);
    // Rating recalculated: only review left has rating 4
    expect(product.rating).toBe(4);
    expect(product.numOfReviews).toBe(1);
    expect(product.save).toHaveBeenCalled();
    expect(mockCacheDel).toHaveBeenCalledWith("item:prod123");
    expect(mockCacheDelPattern).toHaveBeenCalledWith("list:*");
  });

  it("should set rating to 0 when last review is deleted", async () => {
    const req = mockReq({
      query: { productId: "prod123", reviewId: "rev1" },
    });
    const res = mockRes();

    // Product has only 1 review — deleting it leaves 0 reviews
    const product = createMockProduct({
      reviews: [
        { _id: { toString: () => "rev1" }, userId: "u1", rating: 5 },
      ],
    });
    mockFindById.mockResolvedValue(product);

    await deleteReview(req, res);

    // No reviews left — rating should be 0, not NaN (0/0)
    expect(product.reviews).toHaveLength(0);
    expect(product.rating).toBe(0);
    expect(product.numOfReviews).toBe(0);
  });

  it("should throw NotFoundError when product doesn't exist", async () => {
    const req = mockReq({
      query: { productId: "nonexistent", reviewId: "rev1" },
    });
    const res = mockRes();

    mockFindById.mockResolvedValue(null);

    await expect(deleteReview(req, res)).rejects.toThrow("Product not found");
  });
});

// ═══════════════════════════════════════════════════════════════════
// uploadProductImage
// ═══════════════════════════════════════════════════════════════════

describe("uploadProductImage", () => {
  it("should upload image to Cloudinary and add to product", async () => {
    const req = mockReq({
      params: { id: "prod123" },
      file: { buffer: Buffer.from("fake-image") },
    });
    const res = mockRes();

    const product = createMockProduct({ images: [] });
    mockFindById.mockResolvedValue(product);
    mockUploadImage.mockResolvedValue({
      publicId: "ecommerce/products/abc",
      url: "https://res.cloudinary.com/test/image.jpg",
    });

    await uploadProductImage(req, res);

    // Should upload the buffer to Cloudinary
    expect(mockUploadImage).toHaveBeenCalledWith(Buffer.from("fake-image"));
    // Should add the image reference to the product
    expect(product.images).toHaveLength(1);
    expect(product.images[0]).toEqual({
      publicId: "ecommerce/products/abc",
      url: "https://res.cloudinary.com/test/image.jpg",
    });
    expect(product.save).toHaveBeenCalled();
    // Caches invalidated — product now has a new image
    expect(mockCacheDel).toHaveBeenCalledWith("item:prod123");
    expect(mockCacheDelPattern).toHaveBeenCalledWith("list:*");
  });

  it("should throw ValidationError when no file uploaded", async () => {
    // req.file is undefined — client didn't send a file
    const req = mockReq({ params: { id: "prod123" }, file: undefined });
    const res = mockRes();

    await expect(uploadProductImage(req, res)).rejects.toThrow(
      "Please upload an image file"
    );
  });

  it("should throw ValidationError when Cloudinary is not configured", async () => {
    const req = mockReq({
      params: { id: "prod123" },
      file: { buffer: Buffer.from("data") },
    });
    const res = mockRes();

    // Temporarily set cloudName to empty string (not configured)
    const original = mockConfig.cloudinary.cloudName;
    mockConfig.cloudinary.cloudName = "";

    await expect(uploadProductImage(req, res)).rejects.toThrow(
      "Image upload is not configured"
    );

    // Restore for other tests
    mockConfig.cloudinary.cloudName = original;
  });

  it("should throw NotFoundError when product doesn't exist", async () => {
    const req = mockReq({
      params: { id: "nonexistent" },
      file: { buffer: Buffer.from("data") },
    });
    const res = mockRes();

    mockFindById.mockResolvedValue(null);

    await expect(uploadProductImage(req, res)).rejects.toThrow(
      "Product not found"
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// deleteProductImage
// ═══════════════════════════════════════════════════════════════════

describe("deleteProductImage", () => {
  it("should delete image from Cloudinary and remove from product", async () => {
    const req = mockReq({
      params: { id: "prod123" },
      query: { publicId: "ecommerce/products/abc" },
    });
    const res = mockRes();

    const product = createMockProduct({
      images: [
        { publicId: "ecommerce/products/abc", url: "https://example.com/abc.jpg" },
        { publicId: "ecommerce/products/xyz", url: "https://example.com/xyz.jpg" },
      ],
    });
    mockFindById.mockResolvedValue(product);
    mockDeleteImage.mockResolvedValue(undefined);

    await deleteProductImage(req, res);

    // Should delete from Cloudinary FIRST (before removing from DB)
    expect(mockDeleteImage).toHaveBeenCalledWith("ecommerce/products/abc");
    // Should remove only the matching image, keeping the other
    expect(product.images).toHaveLength(1);
    expect(product.images[0].publicId).toBe("ecommerce/products/xyz");
    expect(product.save).toHaveBeenCalled();
    expect(mockCacheDel).toHaveBeenCalledWith("item:prod123");
  });

  it("should throw ValidationError when publicId is missing", async () => {
    const req = mockReq({
      params: { id: "prod123" },
      query: {}, // No publicId
    });
    const res = mockRes();

    const product = createMockProduct();
    mockFindById.mockResolvedValue(product);

    await expect(deleteProductImage(req, res)).rejects.toThrow(
      "publicId query parameter is required"
    );
  });

  it("should throw NotFoundError when image not found on product", async () => {
    const req = mockReq({
      params: { id: "prod123" },
      query: { publicId: "nonexistent/image" },
    });
    const res = mockRes();

    // Product exists but doesn't have this image
    const product = createMockProduct({ images: [] });
    mockFindById.mockResolvedValue(product);

    await expect(deleteProductImage(req, res)).rejects.toThrow(
      "Image not found"
    );
  });

  it("should throw NotFoundError when product doesn't exist", async () => {
    const req = mockReq({
      params: { id: "nonexistent" },
      query: { publicId: "some/image" },
    });
    const res = mockRes();

    mockFindById.mockResolvedValue(null);

    await expect(deleteProductImage(req, res)).rejects.toThrow(
      "Product not found"
    );
  });
});
