import { z, ORDER_STATUSES } from '@ecommerce/shared';

export const placeOrderSchema = z.object({
  addressId: z.string().min(1, 'Address ID is required'),
});

export const updateStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES, {
    message: `Status must be one of: ${ORDER_STATUSES.join(', ')}`,
  }),
});



