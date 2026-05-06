import amqplib, { type Channel } from 'amqplib';
import type { Server as SocketServer } from 'socket.io';
import { createLogger } from '@ecommerce/shared/logger';
import { config } from '../config/index.js';
import { sendEmail } from '../services/emailService.js';

const logger = createLogger('notification-service');
import * as templates from '../templates/index.js';
import { CircuitBreaker } from '@ecommerce/shared';
import type {
  UserRegisteredEvent,
  OrderPlacedEvent,
  PaymentCompletedEvent,
  PaymentFailedEvent,
  OrderStatusUpdatedEvent,
  PasswordResetRequestedEvent,
} from '@ecommerce/shared/events';

const userBreaker = new CircuitBreaker({ name: 'user-service' });

// Look up a user's email from user-service.
// Wrapped in circuit breaker — if user-service is down, we skip
// notifications quickly instead of timing out on every event.
async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const res = await userBreaker.fire(() =>
      fetch(`${config.userServiceUrl}/api/users/internal/${userId}`)
    );
    if (!res.ok) return null;
    const { data } = await res.json();
    return data.email;
  } catch {
    logger.error({ userId }, 'Failed to fetch email for user');
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
        logger.error({ err: err.message }, 'RabbitMQ connection error');
      });

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

export async function startConsumer(io: SocketServer): Promise<void> {
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
  await channel.bindQueue(QUEUE, EXCHANGE, 'password.reset_requested');


  await channel.prefetch(1);

  logger.info('RabbitMQ consumer listening for notification events');

  channel.consume(QUEUE, async (msg) => {
    if (!msg) return;

    const routingKey = msg.fields.routingKey;
    const data = JSON.parse(msg.content.toString());

    try {
      switch (routingKey) {
        case 'user.registered': {
          const event = data as UserRegisteredEvent;
          const { subject, html } = templates.verifyEmail(event.name, event.verificationToken);
          await sendEmail(event.email, subject, html);
          logger.info({ to: event.email }, 'Verification email sent');
          break;
        }

        case 'password.reset_requested': {
          const event = data as PasswordResetRequestedEvent;
          const { subject, html } = templates.passwordReset(event.resetToken);
          await sendEmail(event.email, subject, html);
          logger.info({ to: event.email }, 'Password reset email sent');
          break;
        }

        case 'order.placed': {
          const event = data as OrderPlacedEvent;
          const email = await getUserEmail(event.userId);
          if (!email) { logger.warn({ userId: event.userId }, 'No email found for user, skipping'); break; }
          const { subject, html } = templates.orderConfirmation(
            event.orderId,
            event.total,
            event.items.length
          );
          await sendEmail(email, subject, html);
          // Push real-time notification to the user's browser.
          // io.to(userId) targets only sockets in that user's room.
          // If the user isn't connected, this is a no-op (no error).
          io.to(event.userId).emit('notification', {
            type: 'order.placed',
            message: `Order ${event.orderId} confirmed`,
            orderId: event.orderId,
          });
          logger.info({ to: email, orderId: event.orderId }, 'Order confirmation sent');
          break;
        }

        case 'payment.completed': {
          const event = data as PaymentCompletedEvent;
          const email = await getUserEmail(event.userId);
          if (!email) { logger.warn({ userId: event.userId }, 'No email found for user, skipping'); break; }
          const { subject, html } = templates.paymentReceipt(
            event.orderId,
            event.amount
          );
          await sendEmail(email, subject, html);
          io.to(event.userId).emit('notification', {
            type: 'payment.completed',
            message: `Payment received for order ${event.orderId}`,
            orderId: event.orderId,
          });
          logger.info({ to: email, orderId: event.orderId }, 'Payment receipt sent');
          break;
        }

        case 'payment.failed': {
          const event = data as PaymentFailedEvent;
          const email = await getUserEmail(event.userId);
          if (!email) { logger.warn({ userId: event.userId }, 'No email found for user, skipping'); break; }
          const { subject, html } = templates.paymentFailed(
            event.orderId,
            event.reason
          );
          await sendEmail(email, subject, html);
          io.to(event.userId).emit('notification', {
            type: 'payment.failed',
            message: `Payment failed for order ${event.orderId}`,
            orderId: event.orderId,
            reason: event.reason,
          });
          logger.info({ to: email, orderId: event.orderId }, 'Payment failure alert sent');
          break;
        }

        case 'order.status_updated': {
          const event = data as OrderStatusUpdatedEvent;
          const email = await getUserEmail(event.userId);
          if (!email) { logger.warn({ userId: event.userId }, 'No email found for user, skipping'); break; }
          const { subject, html } = templates.orderStatusUpdate(
            event.orderId,
            event.newStatus
          );
          await sendEmail(email, subject, html);
          io.to(event.userId).emit('notification', {
            type: 'order.status_updated',
            message: `Order ${event.orderId} is now ${event.newStatus}`,
            orderId: event.orderId,
            status: event.newStatus,
          });
          logger.info({ to: email, orderId: event.orderId, status: event.newStatus }, 'Order status update sent');
          break;
        }

        default:
          logger.warn({ routingKey }, 'Unhandled event');
      }

      channel.ack(msg);
    } catch (err) {
      logger.error({ err, routingKey }, 'Error processing event');
      channel.nack(msg, false, true);
    }
  });
}
