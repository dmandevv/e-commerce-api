import { z } from '@ecommerce/shared';

export const addItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  name: z.string().min(1, 'Product name is required'),
  price: z.number().positive('Price must be greater than 0'),
  quantity: z.number().int('Quantity must be a whole number').min(1, 'Quantity must be at least 1'),
  image: z.string().optional(),
});

export const updateQuantitySchema = z.object({
  quantity: z.number().int('Quantity must be a whole number').min(1, 'Quantity must be at least 1'),
});
