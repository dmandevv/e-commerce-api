import { Router } from 'express';
import {
  getProducts,
  getSingleProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  createProductReview,
  getProductReviews,
  deleteReview,
  uploadProductImage,
  deleteProductImage,
} from '../controllers/productController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '@ecommerce/shared/middleware';
import { createProductSchema, updateProductSchema, createReviewSchema } from '../schemas/productSchemas.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// Public
router.get('/', asyncHandler(getProducts));
router.get('/:id', asyncHandler(getSingleProduct));
router.get('/:id/reviews', asyncHandler(getProductReviews));

// Authenticated users
router.post('/reviews', authenticate, validate(createReviewSchema), asyncHandler(createProductReview));

// Admin only
router.post('/', authenticate, authorize('admin'), validate(createProductSchema), asyncHandler(createProduct));
router.patch('/:id', authenticate, authorize('admin'), validate(updateProductSchema), asyncHandler(updateProduct));
router.delete('/:id', authenticate, authorize('admin'), asyncHandler(deleteProduct));
router.delete('/reviews', authenticate, authorize('admin'), asyncHandler(deleteReview));

// Image upload/delete (admin only)
// upload.single('image') parses one file from the "image" form field into req.file
router.post('/:id/images', authenticate, authorize('admin'), upload.single('image'), asyncHandler(uploadProductImage));
router.delete('/:id/images', authenticate, authorize('admin'), asyncHandler(deleteProductImage));

export default router;
