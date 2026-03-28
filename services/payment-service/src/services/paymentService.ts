import Stripe from 'stripe';
import { prisma } from '../lib/prisma.js';
import { config } from '../config/index.js';
import { publishEvent } from '../events/publisher.js';
import { EventNames } from '@ecommerce/shared/events';
import { NotFoundError } from '@ecommerce/shared/errors';
import type { OrderPlacedEvent, PaymentCompletedEvent, PaymentFailedEvent } from '@ecommerce/shared/events';
const stripe = new Stripe(config.stripeSecretKey);

// ─── Called by RabbitMQ consumer when order.placed arrives ─
export async function createPaymentForOrder(event: OrderPlacedEvent): Promise<void> {
  // Check if payment already exists (idempotency)
  const existing = await prisma.payment.findUnique({
    where: { orderId: event.orderId },
  });

  if (existing) {
    console.log(`Payment already exists for order ${event.orderId}, skipping`);
    return;
  }

  // Create Stripe PaymentIntent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(event.total * 100), // Stripe uses cents
    currency: 'cad',
    metadata: {
      orderId: event.orderId,
      userId: event.userId,
    },
  });

  // Store payment record
  await prisma.payment.create({
    data: {
      orderId: event.orderId,
      userId: event.userId,
      amount: event.total,
      stripePaymentId: paymentIntent.id,
      stripeClientSecret: paymentIntent.client_secret,
    },
  });

  console.log(`PaymentIntent created for order ${event.orderId}: ${paymentIntent.id}`);
}

// ─── Called by REST endpoint — frontend fetches client_secret ─
export async function getPaymentByOrderId(orderId: string, userId: string) {
  const payment = await prisma.payment.findUnique({
    where: { orderId },
  });

  if (!payment) {
    throw new NotFoundError('Payment');
  }

  if (payment.userId !== userId) {
    throw new NotFoundError('Payment');
  }

  return payment;
}

// ─── Called by Stripe webhook ───────────────────────────
export async function handleStripeWebhook(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      const payment = await prisma.payment.update({
        where: { stripePaymentId: paymentIntent.id },
        data: { status: 'COMPLETED' },
      });

      // Publish event for order-service to update order status
      const completedEvent: PaymentCompletedEvent = {
        orderId: payment.orderId,
        userId: payment.userId,
        stripePaymentId: paymentIntent.id,
        amount: Number(payment.amount),
        timestamp: new Date(),
      };

      await publishEvent(EventNames.PAYMENT_COMPLETED, completedEvent);
      console.log(`Payment completed for order ${payment.orderId}`);
      break;
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      const payment = await prisma.payment.update({
        where: { stripePaymentId: paymentIntent.id },
        data: {
          status: 'FAILED',
          failureReason: paymentIntent.last_payment_error?.message || 'Unknown error',
        },
      });

      const failedEvent: PaymentFailedEvent = {
        orderId: payment.orderId,
        userId: payment.userId,
        reason: payment.failureReason || 'Unknown error',
        timestamp: new Date(),
      };

      await publishEvent(EventNames.PAYMENT_FAILED, failedEvent);
      console.log(`Payment failed for order ${payment.orderId}`);
      break;
    }

    default:
      console.log(`Unhandled Stripe event type: ${event.type}`);
  }
}
