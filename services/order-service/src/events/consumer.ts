import amqplib, { type Channel } from 'amqplib';
import { createLogger } from '@ecommerce/shared/logger';
import { prisma } from '../lib/prisma.js';
import { config } from '../config/index.js';
import type { PaymentCompletedEvent, PaymentFailedEvent } from '@ecommerce/shared/events';

const logger = createLogger('order-service');

const EXCHANGE = 'ecommerce.events';
const QUEUE = 'order-service.payments';

async function connectWithRetry(url: string, maxRetries = 10): Promise<amqplib.ChannelModel> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const conn = await amqplib.connect(url);

      // Prevent unhandled 'error' crash — log and let 'close' handle recovery
      conn.on('error', (err) => {
        logger.error({ err: err.message }, 'RabbitMQ connection error');
      });

      // When the connection drops, exit so Docker restart policy brings us back
      conn.on('close', () => {
        logger.error('RabbitMQ connection closed, exiting for restart');
        process.exit(1);
      });

      return conn;
    } catch {
      const delay = Math.min(attempt * 2000, 10000);
      logger.warn({ attempt, maxRetries, delaySecs: delay / 1000 }, 'RabbitMQ connection attempt failed, retrying');
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error(`Failed to connect to RabbitMQ after ${maxRetries} attempts`);
}

export async function startConsumer(): Promise<void> {
  const connection = await connectWithRetry(config.rabbitmqUrl);
  const channel: Channel = await connection.createChannel();

  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });

  // Create a durable queue for this service
  await channel.assertQueue(QUEUE, { durable: true });

  // Bind queue to listen for payment events
  await channel.bindQueue(QUEUE, EXCHANGE, 'payment.*');

  // Process one message at a time
  await channel.prefetch(1);

  logger.info('RabbitMQ consumer listening for payment events');

  channel.consume(QUEUE, async (msg) => {
    if (!msg) return;

    const routingKey = msg.fields.routingKey;
    const data = JSON.parse(msg.content.toString());

    try {
      switch (routingKey) {
        case 'payment.completed':
          await handlePaymentCompleted(data as PaymentCompletedEvent);
          break;
        case 'payment.failed':
          await handlePaymentFailed(data as PaymentFailedEvent);
          break;
        default:
          logger.warn({ routingKey }, 'Unknown routing key');
      }

      // Acknowledge — tells RabbitMQ to remove the message from the queue
      channel.ack(msg);
    } catch (err) {
      logger.error({ err, routingKey }, 'Error processing event');
      // Negative acknowledge — requeue the message for retry
      channel.nack(msg, false, true);
    }
  });
}

async function handlePaymentCompleted(event: PaymentCompletedEvent): Promise<void> {
  await prisma.order.update({
    where: { id: event.orderId },
    data: {
      status: 'PAID',
      stripePaymentId: event.stripePaymentId,
    },
  });

  logger.info({ orderId: event.orderId }, 'Order marked as PAID');
}

async function handlePaymentFailed(event: PaymentFailedEvent): Promise<void> {
  await prisma.order.update({
    where: { id: event.orderId },
    data: { status: 'CANCELLED' },
  });

  logger.info({ orderId: event.orderId, reason: event.reason }, 'Order CANCELLED — payment failed');
}
