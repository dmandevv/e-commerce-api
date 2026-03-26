import { PrismaClient } from '@prisma/order-client';
import { config } from '../config/index.js';
import { publishEvent } from '../events/publisher.js';
import { EventNames } from '@ecommerce/shared/events';
import { NotFoundError, ValidationError } from '@ecommerce/shared/errors';
import { CircuitBreaker } from '@ecommerce/shared';
import type { ICart } from '@ecommerce/shared/types';
import type { OrderPlacedEvent } from '@ecommerce/shared/events';

const prisma = new PrismaClient();

// Separate breaker per downstream service.
// cart-service being down shouldn't affect product-service calls and vice versa.
const cartBreaker = new CircuitBreaker({ name: 'cart-service' });
const productBreaker = new CircuitBreaker({ name: 'product-service' });

// ─── Place Order ────────────────────────────────────────
export async function placeOrder(userId: string, token: string, requestId?: string) {
  // 1. Fetch user's cart from cart-service
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (requestId) headers['X-Request-Id'] = requestId;

  // Cart fetch wrapped in breaker — if cart-service has been failing,
  // we fail fast instead of making the user wait for a timeout.
  const cartResponse = await cartBreaker.fire(() =>
    fetch(`${config.cartServiceUrl}/api/cart`, { headers })
  );

  if (!cartResponse.ok) {
    throw new ValidationError('Failed to fetch cart');
  }

  const { data: cart }: { data: ICart } = await cartResponse.json();

  if (!cart.items.length) {
    throw new ValidationError('Cart is empty');
  }

  // 2. Verify each product exists, has stock, and get real prices
  const verifiedItems = await Promise.all(
    cart.items.map(async (item) => {
      // Each product verification goes through the same breaker instance.
      // If product-service is down, the first few items fail and trip the breaker,
      // then remaining items fail instantly instead of each waiting for timeout.
      const res = await productBreaker.fire(() =>
        fetch(
          `${config.productServiceUrl}/api/products/${item.productId}`,
          { headers: requestId ? { 'X-Request-Id': requestId } : {} }
        )
      );

      if (!res.ok) {
        throw new ValidationError(`Product "${item.name}" is no longer available`);
      }

      const { data: product } = await res.json();

      if (product.stock < item.quantity) {
        throw new ValidationError(
          `"${product.name}" only has ${product.stock} in stock (requested ${item.quantity})`
        );
      }

      return {
        productId: item.productId,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
      };
    })
  );

  // Recalculate total from verified prices
  const total = Math.round(
    verifiedItems.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100
  ) / 100;

  // 3. Create order with verified data
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        userId,
        total,
        items: {
          create: verifiedItems,
        },
      },
      include: { items: true },
    });

    return created;
  });

  // 4. Clear the cart after successful order.
  // Wrapped in breaker but also in try/catch — if clearing fails,
  // the order was already created. Better to have a stale cart
  // than to fail the entire order.
  try {
    await cartBreaker.fire(() =>
      fetch(`${config.cartServiceUrl}/api/cart`, { method: 'DELETE', headers })
    );
  } catch {
    console.error('Failed to clear cart after order — cart may be stale');
  }

  // 5. Publish event for payment-service and notification-service
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
