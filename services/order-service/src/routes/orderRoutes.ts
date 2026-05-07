import { Router } from 'express';
import { placeOrder, getOrder, getMyOrders, updateStatus, getAllOrders, getOrderStats } from '../controllers/orderController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '@ecommerce/shared/middleware';
import { placeOrderSchema, updateStatusSchema } from '../schemas/orderSchemas.js';
import { sanitizeBody } from '@ecommerce/shared/middleware';

const router = Router();

router.get('/internal/stats', asyncHandler(getOrderStats));

router.use(authenticate);

router.post('/', validate(placeOrderSchema), asyncHandler(placeOrder));
router.get('/mine', asyncHandler(getMyOrders));
router.get('/admin', authorize('admin'), asyncHandler(getAllOrders));
router.get('/:id', asyncHandler(getOrder));

// Admin only
router.patch('/:id/status', authorize('admin'), sanitizeBody, validate(updateStatusSchema), asyncHandler(updateStatus));

export default router;
