import { type Channel } from 'amqplib';
import { config } from '../config/index.js';
import { Product } from '../models/Product.js';
import { connectWithRetry } from '@ecommerce/shared';
import type { OrderPlacedEvent, PaymentCompletedEvent, PaymentFailedEvent } from '@ecommerce/shared/events';

const EXCHANGE = 'ecommerce.events';
const QUEUE = 'product-service.inventory';

export async function handleOrderPlaced(event: OrderPlacedEvent): Promise<void> {
  for (const item of event.items) {
    await Product.findOneAndUpdate(
      { 'variants._id': item.variantId },
      { $inc: { 'variants.$.reservedStock': item.quantity } }
    );
  }
}

export async function handlePaymentCompleted(event: PaymentCompletedEvent): Promise<void> {
  for (const item of event.items) {
    await Product.findOneAndUpdate(
      { 'variants._id': item.variantId },
      { $inc: { 'variants.$.stock': -item.quantity, 'variants.$.reservedStock': -item.quantity } }
    );
  }
}

export async function handlePaymentFailed(event: PaymentFailedEvent): Promise<void> {
  for (const item of event.items) {
    await Product.findOneAndUpdate(
      { 'variants._id': item.variantId },
      { $inc: { 'variants.$.reservedStock': -item.quantity } }
    );
  }
}


export async function startConsumer(): Promise<void> {
  const connection = await connectWithRetry(config.rabbitmqUrl);
  const channel: Channel = await connection.createChannel();

  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(QUEUE, { durable: true });

  await channel.bindQueue(QUEUE, EXCHANGE, 'order.placed');
  await channel.bindQueue(QUEUE, EXCHANGE, 'payment.completed');
  await channel.bindQueue(QUEUE, EXCHANGE, 'payment.failed');

  await channel.prefetch(1);

  console.log('product-service inventory consumer ready');

  channel.consume(QUEUE, async (msg) => {
    if (!msg) return;

    const routingKey = msg.fields.routingKey;

    try {
      if (routingKey === 'order.placed') {
        const event: OrderPlacedEvent = JSON.parse(msg.content.toString());
        await handleOrderPlaced(event);
      } else if (routingKey === 'payment.completed') {
        const event: PaymentCompletedEvent = JSON.parse(msg.content.toString());
        await handlePaymentCompleted(event);
      } else if (routingKey === 'payment.failed') {
        const event: PaymentFailedEvent = JSON.parse(msg.content.toString());
        await handlePaymentFailed(event);
      }
      channel.ack(msg);
    } catch (err) {
      console.error(`Error processing ${routingKey}:`, err);
      channel.nack(msg, false, true);
    }
  });
}
