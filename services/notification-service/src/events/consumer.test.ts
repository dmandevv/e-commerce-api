// Tests for notification-service RabbitMQ consumer.
// The consumer handles 5 event types: user.registered, order.placed,
// payment.completed, payment.failed, order.status_updated.
// Each event triggers an email and (except user.registered) a WebSocket push.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────
const {
  mockConnect,
  mockCreateChannel,
  mockAssertExchange,
  mockAssertQueue,
  mockBindQueue,
  mockPrefetch,
  mockConsume,
  mockAck,
  mockNack,
  mockSendEmail,
  mockFetch,
} = vi.hoisted(() => ({
  mockConnect: vi.fn(),
  mockCreateChannel: vi.fn(),
  mockAssertExchange: vi.fn(),
  mockAssertQueue: vi.fn(),
  mockBindQueue: vi.fn(),
  mockPrefetch: vi.fn(),
  mockConsume: vi.fn(),
  mockAck: vi.fn(),
  mockNack: vi.fn(),
  mockSendEmail: vi.fn(),
  mockFetch: vi.fn(),
}));

// ─── Mock: amqplib ────────────────────────────────────────────────
vi.mock("amqplib", () => ({
  default: {
    connect: mockConnect.mockResolvedValue({
      createChannel: mockCreateChannel.mockResolvedValue({
        assertExchange: mockAssertExchange.mockResolvedValue(undefined),
        assertQueue: mockAssertQueue.mockResolvedValue(undefined),
        bindQueue: mockBindQueue.mockResolvedValue(undefined),
        prefetch: mockPrefetch,
        consume: mockConsume,
        ack: mockAck,
        nack: mockNack,
      }),
      on: vi.fn(),
    }),
  },
}));

// ─── Mock: config ─────────────────────────────────────────────────
vi.mock("../config/index.js", () => ({
  config: {
    rabbitmqUrl: "amqp://localhost",
    userServiceUrl: "http://user-service:3001",
  },
}));

// ─── Mock: emailService ───────────────────────────────────────────
vi.mock("../services/emailService.js", () => ({
  sendEmail: mockSendEmail,
}));

// ─── Mock: CircuitBreaker (pass-through) ──────────────────────────
vi.mock("@ecommerce/shared", () => ({
  CircuitBreaker: vi.fn().mockImplementation(function (this: any) {
    this.fire = vi.fn().mockImplementation((fn: Function) => fn());
  }),
}));

// ─── Import AFTER mocks ──────────────────────────────────────────
import { startConsumer } from "./consumer.js";

// ─── Mock Socket.IO server ────────────────────────────────────────
// io.to(userId) returns an object with .emit()
const mockEmit = vi.fn();
const mockIo = {
  to: vi.fn().mockReturnValue({ emit: mockEmit }),
} as any;

// ─── Reset mocks between tests ───────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  // Mock global fetch for getUserEmail calls
  vi.stubGlobal("fetch", mockFetch);
});

// ─── Helper: create a fake RabbitMQ message ───────────────────────
function fakeMsg(routingKey: string, data: any) {
  return {
    fields: { routingKey },
    content: Buffer.from(JSON.stringify(data)),
  };
}

// ─── Helper: mock getUserEmail to return an email ─────────────────
function mockUserEmail(email: string) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: { email } }),
  });
}

// ─── Tests ────────────────────────────────────────────────────────
describe("startConsumer", () => {
  it("should connect and bind all 5 event queues", async () => {
    await startConsumer(mockIo);
    expect(mockConnect).toHaveBeenCalledWith("amqp://localhost");
    expect(mockAssertExchange).toHaveBeenCalledWith("ecommerce.events", "topic", { durable: true });
    expect(mockAssertQueue).toHaveBeenCalledWith("notification-service.events", { durable: true });
    // 5 bindings for the 5 event types
    expect(mockBindQueue).toHaveBeenCalledTimes(5);
    expect(mockConsume).toHaveBeenCalled();
  });
});

describe("message handling", () => {
  // Helper to get the consume callback after starting consumer
  async function getConsumeCallback() {
    await startConsumer(mockIo);
    return mockConsume.mock.calls[0][1];
  }

  it("should send welcome email on user.registered", async () => {
    const callback = await getConsumeCallback();
    mockSendEmail.mockResolvedValue(undefined);

    const msg = fakeMsg("user.registered", { email: "new@test.com", name: "Alice" });
    await callback(msg);

    // sendEmail called with the user's email and a welcome subject
    expect(mockSendEmail).toHaveBeenCalledWith(
      "new@test.com",
      "Welcome to our store!",
      expect.stringContaining("Welcome, Alice")
    );
    expect(mockAck).toHaveBeenCalledWith(msg);
  });

  it("should send order confirmation on order.placed", async () => {
    const callback = await getConsumeCallback();
    mockUserEmail("buyer@test.com");
    mockSendEmail.mockResolvedValue(undefined);

    const msg = fakeMsg("order.placed", {
      orderId: "order-abc12345",
      userId: "user1",
      total: 99.99,
      items: [{ productId: "p1", quantity: 1, price: 99.99 }],
      timestamp: new Date(),
    });
    await callback(msg);

    expect(mockSendEmail).toHaveBeenCalledWith(
      "buyer@test.com",
      expect.stringContaining("Order Confirmed"),
      expect.stringContaining("order-ab")
    );
    // WebSocket notification pushed to user
    expect(mockIo.to).toHaveBeenCalledWith("user1");
    expect(mockEmit).toHaveBeenCalledWith("notification", expect.objectContaining({
      type: "order.placed",
      orderId: "order-abc12345",
    }));
    expect(mockAck).toHaveBeenCalledWith(msg);
  });

  it("should send payment receipt on payment.completed", async () => {
    const callback = await getConsumeCallback();
    mockUserEmail("buyer@test.com");
    mockSendEmail.mockResolvedValue(undefined);

    const msg = fakeMsg("payment.completed", {
      orderId: "order-abc12345",
      userId: "user1",
      stripePaymentId: "pi_123",
      amount: 50,
      timestamp: new Date(),
    });
    await callback(msg);

    expect(mockSendEmail).toHaveBeenCalledWith(
      "buyer@test.com",
      expect.stringContaining("Payment Receipt"),
      expect.stringContaining("$50.00")
    );
    expect(mockEmit).toHaveBeenCalledWith("notification", expect.objectContaining({
      type: "payment.completed",
    }));
    expect(mockAck).toHaveBeenCalledWith(msg);
  });

  it("should send failure alert on payment.failed", async () => {
    const callback = await getConsumeCallback();
    mockUserEmail("buyer@test.com");
    mockSendEmail.mockResolvedValue(undefined);

    const msg = fakeMsg("payment.failed", {
      orderId: "order-abc12345",
      userId: "user1",
      reason: "Card declined",
      timestamp: new Date(),
    });
    await callback(msg);

    expect(mockSendEmail).toHaveBeenCalledWith(
      "buyer@test.com",
      expect.stringContaining("Payment Failed"),
      expect.stringContaining("Card declined")
    );
    expect(mockEmit).toHaveBeenCalledWith("notification", expect.objectContaining({
      type: "payment.failed",
      reason: "Card declined",
    }));
    expect(mockAck).toHaveBeenCalledWith(msg);
  });

  it("should send status update on order.status_updated", async () => {
    const callback = await getConsumeCallback();
    mockUserEmail("buyer@test.com");
    mockSendEmail.mockResolvedValue(undefined);

    const msg = fakeMsg("order.status_updated", {
      orderId: "order-abc12345",
      userId: "user1",
      previousStatus: "PENDING",
      newStatus: "SHIPPED",
      timestamp: new Date(),
    });
    await callback(msg);

    expect(mockSendEmail).toHaveBeenCalledWith(
      "buyer@test.com",
      expect.stringContaining("Order Update"),
      expect.stringContaining("SHIPPED")
    );
    expect(mockEmit).toHaveBeenCalledWith("notification", expect.objectContaining({
      type: "order.status_updated",
      status: "SHIPPED",
    }));
    expect(mockAck).toHaveBeenCalledWith(msg);
  });

  it("should skip email if user email not found", async () => {
    const callback = await getConsumeCallback();
    // getUserEmail returns null
    mockFetch.mockResolvedValue({ ok: false });

    const msg = fakeMsg("order.placed", {
      orderId: "order1",
      userId: "user1",
      total: 10,
      items: [{ productId: "p1", quantity: 1, price: 10 }],
      timestamp: new Date(),
    });
    await callback(msg);

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockAck).toHaveBeenCalledWith(msg);
  });

  it("should nack message on error", async () => {
    const callback = await getConsumeCallback();
    mockSendEmail.mockRejectedValue(new Error("SMTP down"));

    const msg = fakeMsg("user.registered", { email: "new@test.com", name: "Alice" });
    await callback(msg);

    expect(mockNack).toHaveBeenCalledWith(msg, false, true);
  });

  it("should ignore null messages", async () => {
    const callback = await getConsumeCallback();
    await callback(null);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockAck).not.toHaveBeenCalled();
  });
});
