// Tests for payment service: createPaymentForOrder, getPaymentByOrderId, handleStripeWebhook.
// Mocks: Stripe SDK, Prisma, event publisher.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────
const {
  mockPaymentFindUnique,
  mockPaymentCreate,
  mockPaymentUpdate,
  mockStripeCreate,
  mockPublishEvent,
} = vi.hoisted(() => ({
  mockPaymentFindUnique: vi.fn(),
  mockPaymentCreate: vi.fn(),
  mockPaymentUpdate: vi.fn(),
  mockStripeCreate: vi.fn(),
  mockPublishEvent: vi.fn(),
}));

// ─── Mock: Prisma ─────────────────────────────────────────────────
vi.mock("../lib/prisma.js", () => ({
  prisma: {
    payment: {
      findUnique: mockPaymentFindUnique,
      create: mockPaymentCreate,
      update: mockPaymentUpdate,
    },
  },
}));

// ─── Mock: Stripe ─────────────────────────────────────────────────
// The service does: new Stripe(key) then stripe.paymentIntents.create(...)
// We mock the default export as a constructor that returns our mock methods.
vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(function (this: any) {
    this.paymentIntents = {
      create: mockStripeCreate,
    };
  }),
}));

// ─── Mock: config ─────────────────────────────────────────────────
vi.mock("../config/index.js", () => ({
  config: { stripeSecretKey: "sk_test_fake" },
}));

// ─── Mock: event publisher ────────────────────────────────────────
vi.mock("../events/publisher.js", () => ({
  publishEvent: mockPublishEvent,
}));

// ─── Import AFTER mocks ──────────────────────────────────────────
import {
  createPaymentForOrder,
  getPaymentByOrderId,
  handleStripeWebhook,
} from "./paymentService.js";
import { NotFoundError } from "@ecommerce/shared/errors";
import { EventNames } from "@ecommerce/shared/events";
import Stripe from "stripe";

// ─── Reset mocks between tests ───────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

const payment = {
    id: "pay-1",
    orderId: "order1",
    userId: "user1",
    amount: 50,
    stripePaymentId: "pi_123",
    stripeClientSecret: "secret_123",
    items: [],
    status: "PENDING",
    failureReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
};

describe("createPaymentForOrder", () => {
    it("should create payment intent and store in DB", async () => {
        //returns null (no existing payment)
        mockPaymentFindUnique.mockResolvedValue(null);
        mockStripeCreate.mockResolvedValue( { id: "pi_123", client_secret: "secret_123" });
        await createPaymentForOrder({ 
            orderId: "order1", userId: "user1", total: 50, items: [],
            shippingAddress: { name: 'John', street: '123 Main St', city: 'Toronto', province: 'ON', postalCode: 'M1A 1A1', country: 'Canada' },
            timestamp: new Date() });
        expect(mockStripeCreate).toHaveBeenCalledWith({ amount: 5000, currency: 'cad', metadata: { orderId: "order1", userId: "user1" } });
        expect(mockPaymentCreate).toHaveBeenCalledWith({
            data: {
                orderId: "order1",
                userId: "user1",
                amount: 50,
                stripePaymentId: "pi_123",
                stripeClientSecret: "secret_123",
                items: [],
            },
        });
    });
    it("should skip if payment already exists (idempotent)", async () => {
        mockPaymentFindUnique.mockResolvedValue({ });
        await createPaymentForOrder({ 
            orderId: "order1", userId: "user1", total: 50, items: [],
            shippingAddress: { name: 'John', street: '123 Main St', city: 'Toronto', province: 'ON', postalCode: 'M1A 1A1', country: 'Canada' },
            timestamp: new Date() });
        expect(mockStripeCreate).not.toHaveBeenCalled();
        expect(mockPaymentCreate).not.toHaveBeenCalled();
    });
});

describe("getPaymentByOrderId", () => {  
    it("should return payment for valid user", async () => {
        mockPaymentFindUnique.mockResolvedValue(payment);
        const result = await getPaymentByOrderId("order1", "user1");
        expect(result).toEqual(payment);
    });
    it("should throw if payment not found", async () => {
        mockPaymentFindUnique.mockResolvedValue(null);   
        await expect(getPaymentByOrderId("order1", "user1")).rejects.toThrow(NotFoundError);
    });
    it("should throw if user not found", async () => {
        mockPaymentFindUnique.mockResolvedValue({ ...payment, userId: "user2" });
        await expect(getPaymentByOrderId("order1", "user1")).rejects.toThrow(NotFoundError);
    });
});

describe("handleStripeWebhook", () => {
    it("should handle payment_intent.succeeded", async () => {
        mockPaymentUpdate.mockResolvedValue(payment);
        await handleStripeWebhook({ type: "payment_intent.succeeded", data: { object: { id: "pi_123"} } } as Stripe.Event);
        expect(mockPaymentUpdate).toHaveBeenCalledWith({
            where: { stripePaymentId: "pi_123" },
            data: { status: 'COMPLETED' },
        });
        expect(mockPublishEvent).toHaveBeenCalledWith(
            EventNames.PAYMENT_COMPLETED,
            expect.objectContaining({
                orderId: payment.orderId,
                userId: payment.userId,
                stripePaymentId: "pi_123",
            })
        );
    });
    it("should handle payment_intent.payment_failed", async () => {
        mockPaymentUpdate.mockResolvedValue({ ...payment, status: "FAILED", failureReason: "Card declined" });
        await handleStripeWebhook({ 
            type: "payment_intent.payment_failed", 
            data: { object: { id: "pi_123", last_payment_error: { message: "Card declined" } } }
        } as Stripe.Event);
        expect(mockPaymentUpdate).toHaveBeenCalledWith({
            where: { stripePaymentId: "pi_123" },
            data: { status: 'FAILED', failureReason: "Card declined" },
        });
        expect(mockPublishEvent).toHaveBeenCalledWith(
            EventNames.PAYMENT_FAILED,
            expect.objectContaining({
                orderId: payment.orderId,
                userId: payment.userId,
                reason: 'Card declined',
            })
        );
    });
    it("should ignore unhandled event types", async () => {
        await handleStripeWebhook({ type: "invalid.event.name", data: { object: { } } } as unknown as Stripe.Event);
        expect(mockPaymentUpdate).not.toHaveBeenCalled();
        expect(mockPublishEvent).not.toHaveBeenCalled();
    });
});
