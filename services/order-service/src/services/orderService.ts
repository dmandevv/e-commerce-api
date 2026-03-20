import { PrismaClient } from '@prisma/order-client';
import { config } from '../config/index.js';
import { publishEvent } from '../events/publisher.js';
import { EventNames } from '@ecommerce/shared/events';
import { NotFoundError, ValidationError } from '@ecommerce/shared/errors';
import type { ICart } from '@ecommerce/shared/types';
import type { OrderPlacedEvent } from '@ecommerce/shared/events';

const prisma = new PrismaClient();

// ─── Place Order ────────────────────────────────────────
export async function placeOrder(userId: string, token: string, requestId?: string) {
  // 1. Fetch user's cart from cart-service
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (requestId) headers['X-Request-Id'] = requestId;

  const cartResponse = await fetch(`${config.cartServiceUrl}/api/cart`, {
    headers,
  });

  if (!cartResponse.ok) {
    throw new ValidationError('Failed to fetch cart');
  }

  const { data: cart }: { data: ICart } = await cartResponse.json();

  if (!cart.items.length) {
    throw new ValidationError('Cart is empty');
  }

  // 2. Create order with items in a transaction
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        userId,
        total: cart.total,
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: true },
    });

    return created;
  });

  // 3. Clear the cart after successful order
  await fetch(`${config.cartServiceUrl}/api/cart`, {
    method: 'DELETE',
    headers,
  });

  // 4. Publish event for payment-service and notification-service
  const event: OrderPlacedEvent = {
    orderId: order.id,
    userId,
    items: order.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      price: Number(item.price),
    })),
    total: Number(order.total),
    timestamp: new Date(),
  };

  await publishEvent(EventNames.ORDER_PLACED, event);

  return order;
}

// ─── Get Order by ID ────────────────────────────────────
export async function getOrderById(orderId: string, userId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    throw new NotFoundError('Order');
  }

  // Users can only view their own orders (admins could bypass — add later)
  if (order.userId !== userId) {
    throw new NotFoundError('Order');
  }

  return order;
}

// ─── Get User's Orders ─────────────────────────────────
export async function getUserOrders(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Update Order Status (admin) ────────────────────────
export async function updateOrderStatus(orderId: string, status: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new NotFoundError('Order');
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: status as any },
    include: { items: true },
  });

  await publishEvent(EventNames.ORDER_STATUS_UPDATED, {
    orderId: updated.id,
    userId: updated.userId,
    previousStatus: order.status,
    newStatus: updated.status,
    timestamp: new Date(),
  });

  return updated;
}
