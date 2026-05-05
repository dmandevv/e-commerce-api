// ─── Event Names ────────────────────────────────────────
// String literal union prevents typos in event routing
export const EventNames = {
  // User events
  USER_REGISTERED: 'user.registered',
  USER_UPDATED: 'user.updated',
  PASSWORD_RESET_REQUESTED: 'password.reset_requested',

  // Product events
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  PRODUCT_DELETED: 'product.deleted',
  STOCK_UPDATED: 'stock.updated',

  // Cart events
  CART_CHECKED_OUT: 'cart.checked_out',

  // Order events
  ORDER_PLACED: 'order.placed',
  ORDER_STATUS_UPDATED: 'order.status_updated',

  // Payment events
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
} as const;

export type EventName = typeof EventNames[keyof typeof EventNames];

// ─── Event Payloads ─────────────────────────────────────
export interface UserRegisteredEvent {
  userId: string;
  email: string;
  name: string;
  verificationToken: string;
  timestamp: Date;
}

export interface OrderPlacedEvent {
  orderId: string;
  userId: string;
  items: Array<{
    productId: string;
    variantId: string; // needed so product-service knows which variant to reserve
    quantity: number;
    price: number 
  }>;
  total: number;
  shippingAddress: { // snapshot of IAddress - same as IOrder
    name: string;
    street: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  }
  timestamp: Date;
}

export interface PasswordResetRequestedEvent {
  userId: string;
  email: string;
  resetToken: string;
  timestamp: Date;
}

export interface PaymentCompletedEvent {
  orderId: string;
  userId: string;
  stripePaymentId: string;
  amount: number;
  items: Array<{ variantId: string; quantity: number }>;
  timestamp: Date;
}

export interface PaymentFailedEvent {
  orderId: string;
  userId: string;
  reason: string;
  items: Array<{ variantId: string; quantity: number }>;
  timestamp: Date;
}

export interface StockUpdatedEvent {
  productId: string;
  previousStock: number;
  newStock: number;
  timestamp: Date;
}

export interface OrderStatusUpdatedEvent {
  orderId: string;
  userId: string;
  previousStatus: string;
  newStatus: string;
  timestamp: Date;
}

