import { Router } from 'express';
import { register, login, getProfile } from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '@ecommerce/shared/middleware';
import { registerSchema, loginSchema } from '../schemas/userSchemas.js';

const router = Router();

// Public routes
router.post('/register', validate(registerSchema), asyncHandler(register));
router.post('/login', validate(loginSchema), asyncHandler(login));

// Protected routes
router.get('/profile', authenticate, asyncHandler(getProfile));

export default router;
