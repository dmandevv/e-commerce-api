import { Router } from 'express';
import { placeOrder, getOrder, getMyOrders, updateStatus } from '../controllers/orderController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '@ecommerce/shared/middleware';
import { updateStatusSchema } from '../schemas/orderSchemas.js';
import { sanitizeBody } from '@ecommerce/shared/middleware';

const router = Router();

router.use(authenticate);

router.post('/', asyncHandler(placeOrder));
router.get('/mine', asyncHandler(getMyOrders));
router.get('/:id', asyncHandler(getOrder));

// Admin only
router.patch('/:id/status', authorize('admin'), sanitizeBody, validate(updateStatusSchema), asyncHandler(updateStatus));

export default router;
