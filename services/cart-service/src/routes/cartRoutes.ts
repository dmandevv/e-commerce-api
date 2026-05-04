import { Router } from 'express';
import {
  getCart,
  addItem,
  updateQuantity,
  removeItem,
  clearCart,
} from '../controllers/cartController.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '@ecommerce/shared/middleware';
import { addItemSchema, updateQuantitySchema } from '../schemas/cartSchemas.js';

const router = Router();

// All cart routes require authentication
router.use(authenticate);

router.get('/', asyncHandler(getCart));
router.post('/items', validate(addItemSchema), asyncHandler(addItem));
router.patch('/items/:variantId', validate(updateQuantitySchema), asyncHandler(updateQuantity));
router.delete('/items/:variantId', asyncHandler(removeItem));
router.delete('/', asyncHandler(clearCart));

export default router;
