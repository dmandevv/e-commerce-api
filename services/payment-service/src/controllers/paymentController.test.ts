// Tests for payment controller: getPayment, stripeWebhook.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────
const { mockGetPaymentByOrderId, mockHandleStripeWebhook } = vi.hoisted(() => ({
  mockGetPaymentByOrderId: vi.fn(),
  mockHandleStripeWebhook: vi.fn(),
}));

// ─── Mock: payment service ────────────────────────────────────────
vi.mock("../services/paymentService.js", () => ({
  getPaymentByOrderId: mockGetPaymentByOrderId,
  handleStripeWebhook: mockHandleStripeWebhook,
}));

// ─── Mock: config ─────────────────────────────────────────────────
// stripeWebhookSecret is empty string → triggers the dev path (JSON.parse)
vi.mock("../config/index.js", () => ({
  config: { stripeSecretKey: "sk_test_fake", stripeWebhookSecret: "" },
}));

// ─── Mock: Stripe (controller creates its own instance for webhook verify)
vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(function (this: any) {
    this.webhooks = {
      constructEvent: vi.fn(),
    };
  }),
}));

// ─── Import controller AFTER mocks ───────────────────────────────
import { getPayment, stripeWebhook } from "./paymentController.js";

// ─── Helpers: fake req / res ──────────────────────────────────────
function mockReq(overrides = {}) {
  return {
    user: { id: "user1" },
    params: {},
    headers: {},
    body: "",
    ...overrides,
  } as any;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

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
  status: "PENDING",
  failureReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("getPayment", () => {
    it("should return payment for order", async () => {
        mockGetPaymentByOrderId.mockResolvedValue(payment);
        const req = mockReq({ params: { orderId: payment.orderId } });
        const res = mockRes();
        await getPayment(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ success: true, data: payment });
    });
});

describe("stripeWebhook", () => {
    it("should parse event and call handleStripeWebhook (dev mode)", async () => {
        const req = mockReq({ body: Buffer.from(JSON.stringify({ type: "payment_intent.succeeded", data: { object: { id: "pi_123" } } })) });
        const res = mockRes();
        mockHandleStripeWebhook.mockResolvedValue(undefined);
        await stripeWebhook(req, res);
        expect(mockHandleStripeWebhook).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ received: true })
    });
});