import amqplib, { type Channel } from 'amqplib';
import { config } from '../config/index.js';
import { sendEmail } from '../services/emailService.js';
import * as templates from '../templates/index.js';
import type {
  UserRegisteredEvent,
  OrderPlacedEvent,
  PaymentCompletedEvent,
  PaymentFailedEvent,
  OrderStatusUpdatedEvent,
} from '@ecommerce/shared/events';

// Look up a user's email from user-service
async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const res = await fetch(`${config.userServiceUrl}/api/users/internal/${userId}`);
    if (!res.ok) return null;
    const { data } = await res.json();
    return data.email;
  } catch {
    console.error(`Failed to fetch email for user ${userId}`);
    return null;
  }
}

const EXCHANGE = 'ecommerce.events';
const QUEUE = 'notification-service.events';

async function connectWithRetry(url: string, maxRetries = 10): Promise<amqplib.ChannelModel> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const conn = await amqplib.connect(url);

      conn.on('error', (err) => {
        console.error('RabbitMQ connection error:', err.message);
      });

      conn.on('close', () => {
        console.error('RabbitMQ connection closed. Exiting for restart...');
        process.exit(1);
      });

      return conn;
    } catch {
      const delay = Math.min(attempt * 2000, 10000);
      console.log(`RabbitMQ attempt ${attempt}/${maxRetries} failed, retrying in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error(`Failed to connect to RabbitMQ after ${maxRetries} attempts`);
}

export async function startConsumer(): Promise<void> {
  const connection = await connectWithRetry(config.rabbitmqUrl);
  const channel: Channel = await connection.createChannel();

  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(QUEUE, { durable: true });

  // Bind to all events this service cares about
  await channel.bindQueue(QUEUE, EXCHANGE, 'user.registered');
  await channel.bindQueue(QUEUE, EXCHANGE, 'order.placed');
  await channel.bindQueue(QUEUE, EXCHANGE, 'payment.completed');
  await channel.bindQueue(QUEUE, EXCHANGE, 'payment.failed');
  await channel.bindQueue(QUEUE, EXCHANGE, 'order.status_updated');

  await channel.prefetch(1);

  console.log('RabbitMQ consumer listening for notification events');

  channel.consume(QUEUE, async (msg) => {
    if (!msg) return;

    const routingKey = msg.fields.routingKey;
    const data = JSON.parse(msg.content.toString());

    try {
      switch (routingKey) {
        case 'user.registered': {
          const event = data as UserRegisteredEvent;
          const { subject, html } = templates.welcomeEmail(event.name);
          await sendEmail(event.email, subject, html);
          console.log(`Welcome email sent to ${event.email}`);
          break;
        }

        case 'order.placed': {
          const event = data as OrderPlacedEvent;
          const email = await getUserEmail(event.userId);
          if (!email) { console.warn(`No email found for user ${event.userId}, skipping`); break; }
          const { subject, html } = templates.orderConfirmation(
            event.orderId,
            event.total,
            event.items.length
          );
          await sendEmail(email, subject, html);
          console.log(`Order confirmation sent to ${email}`);
          break;
        }

        case 'payment.completed': {
          const event = data as PaymentCompletedEvent;
          const email = await getUserEmail(event.userId);
          if (!email) { console.warn(`No email found for user ${event.userId}, skipping`); break; }
          const { subject, html } = templates.paymentReceipt(
            event.orderId,
            event.amount
          );
          await sendEmail(email, subject, html);
          console.log(`Payment receipt sent to ${email}`);
          break;
        }

        case 'payment.failed': {
          const event = data as PaymentFailedEvent;
          const email = await getUserEmail(event.userId);
          if (!email) { console.warn(`No email found for user ${event.userId}, skipping`); break; }
          const { subject, html } = templates.paymentFailed(
            event.orderId,
            event.reason
          );
          await sendEmail(email, subject, html);
          console.log(`Payment failure alert sent to ${email}`);
          break;
        }

        case 'order.status_updated': {
          const event = data as OrderStatusUpdatedEvent;
          const email = await getUserEmail(event.userId);
          if (!email) { console.warn(`No email found for user ${event.userId}, skipping`); break; }
          const { subject, html } = templates.orderStatusUpdate(
            event.orderId,
            event.newStatus
          );
          await sendEmail(email, subject, html);
          console.log(`Status update sent to ${email}`);
          break;
        }

        default:
          console.warn(`Unhandled event: ${routingKey}`);
      }

      channel.ack(msg);
    } catch (err) {
      console.error(`Error processing ${routingKey}:`, err);
      channel.nack(msg, false, true);
    }
  });
}
