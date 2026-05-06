import { type Channel } from 'amqplib';
import { createLogger } from '@ecommerce/shared/logger';
import { config } from '../config/index.js';
import { connectWithRetry } from '@ecommerce/shared';

const logger = createLogger('payment-service');
let channel: Channel | null = null;

const EXCHANGE = 'ecommerce.events';

export async function connectRabbitMQ(): Promise<void> {
  const connection = await connectWithRetry(config.rabbitmqUrl);
  channel = await connection.createChannel();

  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });

  logger.info('RabbitMQ connected');
}

export async function publishEvent(routingKey: string, data: unknown): Promise<void> {
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized');
  }

  channel.publish(
    EXCHANGE,
    routingKey,
    Buffer.from(JSON.stringify(data)),
    { persistent: true }
  );
}
