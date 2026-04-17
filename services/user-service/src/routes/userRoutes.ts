import { Router } from 'express';
import { register, login, getProfile, getUserById } from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '@ecommerce/shared/middleware';
import { registerSchema, loginSchema } from '../schemas/userSchemas.js';
import { sanitizeBody } from '@ecommerce/shared/middleware';

const router = Router();

// Public routes
router.post('/register', sanitizeBody, validate(registerSchema), asyncHandler(register));
router.post('/login', validate(loginSchema), asyncHandler(login));

// Internal (service-to-service only — not exposed through NGINX,
// so it's unreachable from the internet. Safe to skip auth.)
router.get('/internal/:id', asyncHandler(getUserById));

// Protected routes
router.get('/profile', authenticate, asyncHandler(getProfile));

export default router;
