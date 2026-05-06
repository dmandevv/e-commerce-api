import { config } from '../config/index.js';

import { type Channel } from 'amqplib';
import { connectWithRetry } from '@ecommerce/shared';
let channel: Channel | null = null;
const EXCHANGE = 'ecommerce.events';

import { createLogger } from '@ecommerce/shared/logger';
const logger = createLogger('user-service');


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