// Tests for RabbitMQ event publisher.
// We mock amqplib so no real connection is needed.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────
// mockChannel simulates a RabbitMQ channel with publish and assertExchange.
// mockConnection simulates the connection that creates the channel.
const { mockPublish, mockAssertExchange, mockCreateChannel, mockConnect } =
  vi.hoisted(() => {
    const mockPublish = vi.fn();
    const mockAssertExchange = vi.fn();
    const mockCreateChannel = vi.fn();
    const mockConnect = vi.fn();
    return { mockPublish, mockAssertExchange, mockCreateChannel, mockConnect };
  });

// ─── Mock: amqplib ────────────────────────────────────────────────
// amqplib.connect() returns a connection → connection.createChannel() returns a channel.
// We chain the mocks so connect → { createChannel } → { publish, assertExchange }.
vi.mock("amqplib", () => ({
  default: {
    connect: mockConnect.mockResolvedValue({
      createChannel: mockCreateChannel.mockResolvedValue({
        publish: mockPublish,
        assertExchange: mockAssertExchange.mockResolvedValue(undefined),
      }),
      // connection event handlers — controller registers these but we don't test them
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

describe("publishEvent", () => {
    it("should throw if channel not initialized", async () => {
        await expect(publishEvent("order.placed", { orderId: "123" })).rejects.toThrow();
    });
    it("should publish event to exchange", async () => {
        await connectRabbitMQ();
        await publishEvent("order.placed", { orderId: "123" });
        expect(mockPublish).toHaveBeenCalledWith(
            "ecommerce.events",
            "order.placed",
            Buffer.from(JSON.stringify({ orderId: "123" })),
            { persistent: true }
        );
    })
});

describe("connectRabbitMQ", () => {
    it("should connect and create a channel", async () => {
        await connectRabbitMQ();
        expect(mockConnect).toHaveBeenCalledWith("amqp://localhost");
        expect(mockCreateChannel).toHaveBeenCalled();
        expect(mockAssertExchange).toHaveBeenCalledWith("ecommerce.events", "topic", { durable: true });
    });
});