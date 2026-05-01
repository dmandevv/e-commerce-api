import { config } from "../config/index.js";


// Expiry times mirror TTL_BY_TYPE in user-service/src/lib/verificationToken.ts
export function verifyEmail(name: string, verificationToken: string): { subject: string; html: string } {
  return {
    subject: 'Verify your email address',
    html: `
      <h1>Hi ${name}, please verify your email</h1>
      <p>Click the link below to verify your email address. The link expires in 24 hours.</p>
      <a href="${config.clientUrl}/auth/verify-email/${verificationToken}">Verify my email</a>
    `,
  };
}

// Expiry times mirror TTL_BY_TYPE in user-service/src/lib/verificationToken.ts
export function passwordReset(resetToken: string): { subject: string; html: string } {
  return {
    subject: 'Reset your password',
    html: `
      <h1>Password reset request</h1>
      <p>Click the link below to reset your password. The link expires in 1 hour.</p>
      <a href="${config.clientUrl}/auth/reset-password/${resetToken}">Reset my password</a>
      <p>If you didn't request this, ignore this email.</p>
    `,
  };
}

export function orderConfirmation(
  orderId: string,
  total: number,
  itemCount: number
): { subject: string; html: string } {
  return {
    subject: `Order Confirmed — #${orderId.slice(0, 8)}`,
    html: `
      <h1>Order Confirmed</h1>
      <p>Your order <strong>#${orderId.slice(0, 8)}</strong> has been placed.</p>
      <p>Items: ${itemCount} | Total: $${total.toFixed(2)}</p>
      <p>We'll notify you when payment is processed.</p>
    `,
  };
}

export function paymentReceipt(
  orderId: string,
  amount: number
): { subject: string; html: string } {
  return {
    subject: `Payment Receipt — #${orderId.slice(0, 8)}`,
    html: `
      <h1>Payment Received</h1>
      <p>We've received your payment of <strong>$${amount.toFixed(2)}</strong>
         for order #${orderId.slice(0, 8)}.</p>
      <p>Your order is now being processed.</p>
    `,
  };
}

export function paymentFailed(
  orderId: string,
  reason: string
): { subject: string; html: string } {
  return {
    subject: `Payment Failed — #${orderId.slice(0, 8)}`,
    html: `
      <h1>Payment Failed</h1>
      <p>Your payment for order #${orderId.slice(0, 8)} could not be processed.</p>
      <p>Reason: ${reason}</p>
      <p>Please try again or use a different payment method.</p>
    `,
  };
}

export function orderStatusUpdate(
  orderId: string,
  newStatus: string
): { subject: string; html: string } {
  return {
    subject: `Order Update — #${orderId.slice(0, 8)}`,
    html: `
      <h1>Order Update</h1>
      <p>Your order #${orderId.slice(0, 8)} status has been updated to:
         <strong>${newStatus}</strong></p>
    `,
  };
}