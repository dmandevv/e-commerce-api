import { z, ORDER_STATUSES } from '@ecommerce/shared';

export const updateStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES, {
    message: `Status must be one of: ${ORDER_STATUSES.join(', ')}`,
  }),
});
