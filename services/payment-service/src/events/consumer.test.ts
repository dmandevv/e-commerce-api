// Tests for payment-service RabbitMQ consumer.
// Mocks amqplib and the payment service to test message handling.

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
  mockCreatePaymentForOrder,
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
  mockCreatePaymentForOrder: vi.fn(),
}));

// ─── Mock: amqplib ────────────────────────────────────────────────
// The consumer calls: connect → createChannel → assertExchange, assertQueue,
// bindQueue, prefetch, consume. We chain the mocks to match this flow.
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
  config: { rabbitmqUrl: "amqp://localhost" },
}));

// ─── Mock: payment service ────────────────────────────────────────
vi.mock("../services/paymentService.js", () => ({
  createPaymentForOrder: mockCreatePaymentForOrder,
}));

// ─── Import AFTER mocks ──────────────────────────────────────────
import { startConsumer } from "./consumer.js";

// ─── Reset mocks between tests ───────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────
describe("startConsumer", () => {
  it("should connect, bind queue, and start consuming", async () => {
    await startConsumer();
    // Verify connection
    expect(mockConnect).toHaveBeenCalledWith("amqp://localhost");
    expect(mockCreateChannel).toHaveBeenCalled();
    // Verify exchange and queue setup
    expect(mockAssertExchange).toHaveBeenCalledWith("ecommerce.events", "topic", {
      durable: true,
    });
    expect(mockAssertQueue).toHaveBeenCalledWith("payment-service.orders", {
      durable: true,
    });
    expect(mockBindQueue).toHaveBeenCalledWith(
      "payment-service.orders",
      "ecommerce.events",
      "order.placed"
    );
    // Verify prefetch and consume were called
    expect(mockPrefetch).toHaveBeenCalledWith(1);
    expect(mockConsume).toHaveBeenCalledWith("payment-service.orders", expect.any(Function));
  });

  it("should ack message on successful processing", async () => {
    // Make createPaymentForOrder succeed
    mockCreatePaymentForOrder.mockResolvedValue(undefined);
    await startConsumer();

    // Get the callback that was passed to channel.consume()
    const consumeCallback = mockConsume.mock.calls[0][1];

    // Create a fake RabbitMQ message
    const fakeMessage = {
      content: Buffer.from(
        JSON.stringify({ orderId: "order1", userId: "user1", total: 50, items: [], timestamp: new Date() })
      ),
    };

    // Call the callback as if RabbitMQ delivered a message
    await consumeCallback(fakeMessage);

    // Should process the order and ack the message
    expect(mockCreatePaymentForOrder).toHaveBeenCalled();
    expect(mockAck).toHaveBeenCalledWith(fakeMessage);
  });

  it("should nack message on processing error", async () => {
    // Make createPaymentForOrder throw an error
    mockCreatePaymentForOrder.mockRejectedValue(new Error("DB down"));
    await startConsumer();

    const consumeCallback = mockConsume.mock.calls[0][1];

    const fakeMessage = {
      content: Buffer.from(JSON.stringify({ orderId: "order1" })),
    };

    await consumeCallback(fakeMessage);

    // Should nack the message for redelivery
    expect(mockNack).toHaveBeenCalledWith(fakeMessage, false, true);
  });

  it("should ignore null messages", async () => {
    await startConsumer();

    const consumeCallback = mockConsume.mock.calls[0][1];

    // RabbitMQ sends null when consumer is cancelled
    await consumeCallback(null);

    expect(mockCreatePaymentForOrder).not.toHaveBeenCalled();
    expect(mockAck).not.toHaveBeenCalled();
  });
});
