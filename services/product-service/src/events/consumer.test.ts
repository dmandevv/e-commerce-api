import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindOneAndUpdate } = vi.hoisted(() => ({
  mockFindOneAndUpdate: vi.fn(),
}));

vi.mock('../models/Product.js', () => ({
  Product: {
    findOneAndUpdate: mockFindOneAndUpdate,
  },
}));

import { handleOrderPlaced, handlePaymentCompleted, handlePaymentFailed } from './consumer.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleOrderPlaced', () => {
  it('should increment reservedStock for each item', async () => {
    mockFindOneAndUpdate.mockResolvedValue({});
    await handleOrderPlaced({
      orderId: 'o1', userId: 'u1', total: 100, shippingAddress: {} as any, timestamp: new Date(),
      items: [{ variantId: 'v1', quantity: 2, productId: 'p1', price: 50 }],
    });
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { 'variants._id': 'v1' },
      { $inc: { 'variants.$.reservedStock': 2 } }
    );
  });
});

describe('handlePaymentCompleted', () => {
  it('should decrement stock and reservedStock for each item', async () => {
    mockFindOneAndUpdate.mockResolvedValue({});
    await handlePaymentCompleted({
      orderId: 'o1', userId: 'u1', stripePaymentId: 'pi_1', amount: 100, timestamp: new Date(),
      items: [{ variantId: 'v1', quantity: 2 }],
    });
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { 'variants._id': 'v1' },
      { $inc: { 'variants.$.stock': -2, 'variants.$.reservedStock': -2 } }
    );
  });
});

describe('handlePaymentFailed', () => {
  it('should decrement reservedStock only for each item', async () => {
    mockFindOneAndUpdate.mockResolvedValue({});
    await handlePaymentFailed({
      orderId: 'o1', userId: 'u1', reason: 'declined', timestamp: new Date(),
      items: [{ variantId: 'v1', quantity: 2 }],
    });
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { 'variants._id': 'v1' },
      { $inc: { 'variants.$.reservedStock': -2 } }
    );
  });
});
