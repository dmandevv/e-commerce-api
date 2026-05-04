import { z } from '@ecommerce/shared';

// Client only sends productId + quantity.
// Name, price, and image are fetched from product-service.
export const addItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().min(1, 'Variant ID is required'),
  quantity: z.number().int('Quantity must be a whole number').min(1, 'Quantity must be at least 1'),
});

export const updateQuantitySchema = z.object({
  quantity: z.number().int('Quantity must be a whole number').min(1, 'Quantity must be at least 1'),
});
