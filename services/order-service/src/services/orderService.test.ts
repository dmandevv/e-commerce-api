// Tests for the order service: placeOrder, getOrderById, getUserOrders, updateOrderStatus.
// This is the business logic layer — it coordinates between:
// - Prisma (PostgreSQL) for order storage
// - Cart-service + Product-service (HTTP via circuit breakers) for validation
// - RabbitMQ (publisher) for emitting order events

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────
const {
  mockPrismaOrderCreate,
  mockPrismaOrderFindUnique,
  mockPrismaOrderFindMany,
  mockPrismaOrderUpdate,
  mockPrismaTransaction,
  mockPublishEvent,
} = vi.hoisted(() => ({
  mockPrismaOrderCreate: vi.fn(),
  mockPrismaOrderFindUnique: vi.fn(),
  mockPrismaOrderFindMany: vi.fn(),
  mockPrismaOrderUpdate: vi.fn(),
  mockPrismaTransaction: vi.fn(),
  mockPublishEvent: vi.fn(),
}));

// ─── Mock: Prisma client ──────────────────────────────────────────
// The service imports `prisma` from ../lib/prisma.js.
// We replace it with a fake that has mock methods for order operations.
// $transaction receives a callback and passes a "tx" object —
// our mock calls the callback with the same mock methods so
// tx.order.create works the same as prisma.order.create in tests.
vi.mock("../lib/prisma.js", () => ({
  prisma: {
    order: {
      create: mockPrismaOrderCreate,
      findUnique: mockPrismaOrderFindUnique,
      findMany: mockPrismaOrderFindMany,
      update: mockPrismaOrderUpdate,
    },
    // $transaction(callback) calls callback with a "tx" object.
    // We pass the same mock methods so tx.order.create === prisma.order.create.
    $transaction: mockPrismaTransaction,
  },
}));

// ─── Mock: CircuitBreaker ─────────────────────────────────────────
// Two breakers in orderService: cartBreaker and productBreaker.
// Our mock makes fire() a pass-through — just executes the function.
vi.mock("@ecommerce/shared", () => ({
  CircuitBreaker: vi.fn().mockImplementation(function (this: any) {
    this.fire = vi.fn().mockImplementation((fn: Function) => fn());
  }),
}));

// ─── Mock: Event publisher ────────────────────────────────────────
vi.mock("../events/publisher.js", () => ({
  publishEvent: mockPublishEvent,
}));

// ─── Mock: Config ─────────────────────────────────────────────────
vi.mock("../config/index.js", () => ({
  config: {
    cartServiceUrl: "http://cart-service:3003",
    productServiceUrl: "http://product-service:3002",
  },
}));

// ─── Import service AFTER all mocks ───────────────────────────────
import {
  placeOrder,
  getOrderById,
  getUserOrders,
  updateOrderStatus,
} from "./orderService.js";

import { NotFoundError, ValidationError } from "@ecommerce/shared/errors";
import { EventNames } from '@ecommerce/shared/events';

// ─── Mock: global fetch ───────────────────────────────────────────
const mockFetch = vi.fn();

// ─── Reset mocks between tests ────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);

  // Default $transaction behavior: call the callback with the same mock methods.
  // This simulates Prisma's transaction: prisma.$transaction(async (tx) => { tx.order.create(...) })
  mockPrismaTransaction.mockImplementation(async (callback: Function) => {
    return callback({
      order: {
        create: mockPrismaOrderCreate,
      },
    });
  });
});

describe("getUserOrders", () => {
    const orderItem1 = { productId: "p1", name: "product1", price: 2, quantity: 3 };
    const orderItem2 = { productId: "p2", name: "product2", price: 10, quantity: 1 };
    const orderItem3 = { productId: "p3", name: "product3", price: 35, quantity: 1 };
    const order1 = { id: "order1", userId: "user123", items: [orderItem1, orderItem2], total: 16, status: "PAID", stripePaymentId: "stripe", createdAt: Date.now() - 10000, updatedAt: Date.now() };
    const order2 = { id: "order2", userId: "user123", items: [orderItem3], total: 35, status: "PENDING", stripePaymentId: "", createdAt: Date.now() - 500000, updatedAt: Date.now() };
    it("should return an array of orders for user", async () => {
        mockPrismaOrderFindMany.mockResolvedValue([order1, order2]);
        const orders = await getUserOrders("user123");
        expect(orders).toEqual([order1, order2])
        expect(mockPrismaOrderFindMany).toHaveBeenCalledWith({
            where: { userId: "user123" },
            include: { items: true },
            orderBy: { createdAt: 'desc' },
        });
    });
});

describe("getOrderById", () => {
    const order1 = { id: "order1", userId: "user123", items: [], total: 0, status: "", stripePaymentId: "", createdAt: Date.now() - 10000, updatedAt: Date.now() };
    const order2 = { id: "order2", userId: "user456", items: [], total: 0, status: "", stripePaymentId: "", createdAt: Date.now() - 500000, updatedAt: Date.now() };
    it("should return return an order that exists and belongs to the user", async () => {
        mockPrismaOrderFindUnique.mockResolvedValue(order1);
        const order = await getOrderById("order1", "user123");
        expect(order).toEqual(order1)
        expect(mockPrismaOrderFindUnique).toHaveBeenCalledWith({
            where: { id: "order1" },
            include: { items: true },
        });
    });
    it("should return an error if order is not found", async () => {
        mockPrismaOrderFindUnique.mockResolvedValue(null);
        await expect(getOrderById("fake_order", "user123")).rejects.toThrow(NotFoundError);
    });
    it("should return an error if order exists but belongs to another user", async () => {
        mockPrismaOrderFindUnique.mockResolvedValue(order2);
        await expect(getOrderById("order2", "user123")).rejects.toThrow(NotFoundError);
    });
});

describe("updateOrderStatus", () => {
    const orderItem1 = { productId: "p1", name: "product1", price: 2, quantity: 3 };
    const orderItem2 = { productId: "p2", name: "product2", price: 10, quantity: 1 };
    const originalOrder = { id: "order1", userId: "user123", items: [orderItem1, orderItem2], total: 16, status: "PAID", stripePaymentId: "stripe", createdAt: Date.now() - 10000, updatedAt: Date.now() };
    const shippedOrder = { id: "order1", userId: "user123", items: [orderItem1, orderItem2], total: 16, status: "SHIPPED", stripePaymentId: "stripe", createdAt: Date.now() - 10000, updatedAt: Date.now() };
    it("should update order status and publish event", async () => {
        mockPrismaOrderFindUnique.mockResolvedValue(originalOrder);
        mockPrismaOrderUpdate.mockResolvedValue(shippedOrder);
        const order = await updateOrderStatus("order1", "SHIPPED");
        expect(order).toEqual(shippedOrder);
        expect(mockPrismaOrderUpdate).toHaveBeenCalledWith({
            where: { id: "order1" },
            data: { status: "SHIPPED" },
            include: { items: true },
        });
        expect(mockPublishEvent).toHaveBeenCalledWith(
            EventNames.ORDER_STATUS_UPDATED,
            expect.objectContaining({
                orderId: "order1",
                userId: "user123",
                previousStatus: "PAID",
                newStatus: "SHIPPED",
            })
        );
    });
    it("should return an error if order doesn't exist", async () => {
        mockPrismaOrderFindUnique.mockResolvedValue(null);
        await expect(updateOrderStatus("deleted_order", "SHIPPED")).rejects.toThrow(NotFoundError);
    });
});

describe("placeOrder", () => {
    const orderItem = { productId: "p1", name: "product1", price: 1, quantity: 1 };
    const cart = { items: [orderItem] }
    const successfulOrder = { id: "order1", userId: "user123", items: [orderItem], total: 1, status: "PAID", stripePaymentId: "stripe", createdAt: Date.now(), updatedAt: Date.now() };
    it("should successfully place an order", async () => {
        const mockResponse = (data: any) => ({
            ok: true,
            json: () => Promise.resolve({ data }),
        });

        //fetch users cart
        mockFetch.mockResolvedValueOnce(mockResponse(cart));
        //check db for products price and stock
        mockFetch.mockResolvedValueOnce(mockResponse({ ...orderItem, stock: 1}));
        //delete cart
        mockFetch.mockResolvedValueOnce(mockResponse({ ok: true }));

        mockPrismaOrderCreate.mockResolvedValue(successfulOrder);
        mockPublishEvent.mockResolvedValue(undefined);

        const result = await placeOrder("user123", "token123", "req-1");
        expect(result).toEqual(successfulOrder);
        expect(mockPrismaOrderCreate).toHaveBeenCalled();
        expect(mockPublishEvent).toHaveBeenCalled();
    });
    it("should return an error if cart is empty", async () => {
        const emptyCart = { items: [] }
        const mockResponse = () => ({
            ok: true,
            json: () => Promise.resolve({ data: emptyCart }),
        });
        mockFetch.mockResolvedValueOnce(mockResponse());
        await expect(placeOrder("user123", "token123", "req-1")).rejects.toThrow(ValidationError);
    });
    it("should return an error if any item is out of stock", async () => {
        const item = { productId: "p1", name: "product1", price: 1, quantity: 1 };
        const cart = { items: [item] }
        const mockResponse = (data: any) => ({
            ok: true,
            json: () => Promise.resolve({ data }),
        });

        //fetch cart
        mockFetch.mockResolvedValueOnce(mockResponse(cart));
        //fetch product with insufficient stock
        mockFetch.mockResolvedValueOnce(mockResponse({ name: "product1", price: 1, stock: 0 }));

        await expect(placeOrder("user123", "token123", "req-1")).rejects.toThrow(ValidationError);
    });
});