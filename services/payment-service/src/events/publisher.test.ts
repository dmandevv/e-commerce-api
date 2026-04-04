// Tests for payment-service RabbitMQ publisher.
// Same pattern as order-service publisher — mock amqplib, test connect + publish.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────
const { mockPublish, mockAssertExchange, mockCreateChannel, mockConnect } =
  vi.hoisted(() => {
    const mockPublish = vi.fn();
    const mockAssertExchange = vi.fn();
    const mockCreateChannel = vi.fn();
    const mockConnect = vi.fn();
    return { mockPublish, mockAssertExchange, mockCreateChannel, mockConnect };
  });

// ─── Mock: amqplib ────────────────────────────────────────────────
vi.mock("amqplib", () => ({
  default: {
    connect: mockConnect.mockResolvedValue({
      createChannel: mockCreateChannel.mockResolvedValue({
        publish: mockPublish,
        assertExchange: mockAssertExchange.mockResolvedValue(undefined),
      }),
      on: vi.fn(),
    }),
  },
}));

// ─── Mock: config ─────────────────────────────────────────────────
vi.mock("../config/index.js", () => ({
  config: { rabbitmqUrl: "amqp://localhost" },
}));

// ─── Import AFTER mocks ──────────────────────────────────────────
import { connectRabbitMQ, publishEvent } from "./publisher.js";

// ─── Reset mocks between tests ───────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────
describe("publishEvent", () => {
  it("should throw if channel not initialized", async () => {
    await expect(publishEvent("payment.completed", { orderId: "123" })).rejects.toThrow(
      "RabbitMQ channel not initialized"
    );
  });

  it("should publish event to exchange", async () => {
    // connectRabbitMQ sets the internal channel
    await connectRabbitMQ();
    await publishEvent("payment.completed", { orderId: "123" });
    expect(mockPublish).toHaveBeenCalledWith(
      "ecommerce.events",
      "payment.completed",
      Buffer.from(JSON.stringify({ orderId: "123" })),
      { persistent: true }
    );
  });
});

describe("connectRabbitMQ", () => {
  it("should connect and create channel", async () => {
    await connectRabbitMQ();
    expect(mockConnect).toHaveBeenCalledWith("amqp://localhost");
    expect(mockCreateChannel).toHaveBeenCalled();
    expect(mockAssertExchange).toHaveBeenCalledWith("ecommerce.events", "topic", {
      durable: true,
    });
  });
});
