// Tests for the cart controller: getCart, addItem, updateQuantity, removeItem, clearCart.
// The controller coordinates between the cart repository (Redis) and
// product-service (HTTP via circuit breaker) for stock validation.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────
const {
  mockGetCart,
  mockAddItem,
  mockUpdateQuantity,
  mockRemoveItem,
  mockClearCart,
} = vi.hoisted(() => ({
  mockGetCart: vi.fn(),
  mockAddItem: vi.fn(),
  mockUpdateQuantity: vi.fn(),
  mockRemoveItem: vi.fn(),
  mockClearCart: vi.fn(),
}));

// ─── Mock: cartRepository ─────────────────────────────────────────
// The controller imports a singleton `cartRepository` instance.
// We replace all 5 methods with mocks so no real Redis calls happen.
vi.mock("../repositories/cartRepository.js", () => ({
  cartRepository: {
    getCart: mockGetCart,
    addItem: mockAddItem,
    updateQuantity: mockUpdateQuantity,
    removeItem: mockRemoveItem,
    clearCart: mockClearCart,
  },
}));

// ─── Mock: CircuitBreaker ─────────────────────────────────────────
// The controller creates a CircuitBreaker at module level:
//   const productBreaker = new CircuitBreaker({ name: 'product-service' });
// Then calls productBreaker.fire(fn) which wraps the fetch call.
//
// Our mock makes fire() simply execute the function it receives —
// the circuit breaker becomes transparent (pass-through).
// Must be a regular function (not arrow) because it's used with `new`.
vi.mock("@ecommerce/shared", () => ({
  CircuitBreaker: vi.fn().mockImplementation(function (this: any) {
    // fire(fn) just calls fn() — no circuit breaker logic in tests.
    // This lets us control fetch directly with vi.stubGlobal.
    this.fire = vi.fn().mockImplementation((fn: Function) => fn());
  }),
}));

// ─── Mock: config ─────────────────────────────────────────────────
vi.mock("../config/index.js", () => ({
  config: {
    productServiceUrl: "http://product-service:3002",
  },
}));

// ─── Import controller AFTER all mocks ────────────────────────────
import {
  getCart,
  addItem,
  updateQuantity,
  removeItem,
  clearCart,
} from "./cartController.js";
import { NotFoundError, ValidationError } from "@ecommerce/shared";

// ─── Mock: global fetch ───────────────────────────────────────────
// The controller calls fetch() to hit product-service for stock validation.
// vi.stubGlobal replaces the global fetch with a mock we can control.
const mockFetch = vi.fn();

// ─── Test helpers ─────────────────────────────────────────────────
function mockReq(overrides: Record<string, unknown> = {}) {
  return {
    query: {},
    params: {},
    body: {},
    user: { id: "user123", role: "customer" },
    ...overrides,
  } as any;
}

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as any;
}

// ─── Reset mocks between tests ────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
});

// ═══════════════════════════════════════════════════════════════════
// YOUR TESTS GO BELOW — write describe blocks for each controller
// ═══════════════════════════════════════════════════════════════════

describe("getCart", () => {
  it("should return a cart object", async () => {
    const cart = { userId: "user123", items: [], total: 0 };
    mockGetCart.mockResolvedValue(cart);
    const req = mockReq();
    const res = mockRes();
    await getCart(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: cart });
    expect(mockGetCart).toHaveBeenCalledWith("user123");
  });
});

describe("updateQuantity", () => {
  it("should update quantity of item in cart", async () => {
    const item = { productId: "p1", name: "Phone", price: 10, quantity: 1, image: "", variantId: 'v1' };
    const updatedCart = { userId: "user123", items: [{ ...item, quantity: 5 }], total: 50 };
    mockUpdateQuantity.mockResolvedValue(updatedCart);
    const req = mockReq({ params: { variantId: 'v1' }, body: { quantity: 5 } });
    const res = mockRes();
    await updateQuantity(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: updatedCart });
    expect(mockUpdateQuantity).toHaveBeenCalledWith("user123", "v1", 5);
  });
});

describe("removeItem", () => {
  it("should remove item from cart", async () => {
    const item = { productId: "p1", name: "Phone", price: 10, quantity: 1, image: "", variantId: 'v1' };
    const updatedCart = { userId: "user123", items: [], total: 0 };
    mockRemoveItem.mockResolvedValue(updatedCart);
    const req = mockReq({ params: { variantId: 'v1' } });
    const res = mockRes();
    await removeItem(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: updatedCart });
    expect(mockRemoveItem).toHaveBeenCalledWith("user123", "v1");
  });
});

describe("clearCart", () => {
  it("should delete cart key from redis", async () => {
    mockClearCart.mockResolvedValue(null);
    const req = mockReq();
    const res = mockRes();
    await clearCart(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Cart cleared' });
    expect(mockClearCart).toHaveBeenCalledWith("user123");
  });
});

describe("addItem", () => {
  it("should add item when product exists and has stock", async () => {
    mockFetch.mockResolvedValue({ok: true, json: () => Promise.resolve({ data: { name: "Phone", price: 10, images: [], variants: [{ id: 'v1', stock: 50, reservedStock: 0 }] } })})
    const item = { productId: "p1", name: "Phone", price: 10, quantity: 1, image: "", variantId: 'v1' };
    const updatedCart = { userId: "user123", items: [item], total: 10 }; 
    mockAddItem.mockResolvedValue(updatedCart);
    const req = mockReq({body: { variantId: "v1", quantity: 1 } });
    const res = mockRes();
    await addItem(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: updatedCart });
  });
  it("should throw when product not found", async () => {
    mockFetch.mockResolvedValue({ok: false });
    const req = mockReq({body: { variantId: "fake_item", quantity: 1 } });
    const res = mockRes();
    await expect(addItem(req, res)).rejects.toThrow();
  });
  it("should throw when insufficient stock", async () => {
    mockFetch.mockResolvedValue({ok: true, json: () => Promise.resolve({ data: { name: "Phone", price: 10, images: [], variants: [{ id: 'v1', stock: 1, reservedStock: 0 }] } })})
    const req = mockReq({body: { variantId: "v1", quantity: 2 } });
    const res = mockRes();
    await expect(addItem(req, res)).rejects.toThrow();
  });
});