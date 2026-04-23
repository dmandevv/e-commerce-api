import { Router } from 'express';
import { register, login, getProfile, getUserById, refresh, logout, getCsrfToken } from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, sanitizeBody } from '@ecommerce/shared/middleware';
import { registerSchema, loginSchema } from '../schemas/userSchemas.js';

const router = Router();

//CSRF token
router.get('/csrf', asyncHandler(getCsrfToken));

// Public routes
router.post('/register', sanitizeBody, validate(registerSchema), asyncHandler(register));
router.post('/login', validate(loginSchema), asyncHandler(login));
router.post('/refresh', asyncHandler(refresh));
router.post('/logout', asyncHandler(logout));

// Internal (service-to-service only — not exposed through NGINX,
// so it's unreachable from the internet. Safe to skip auth.)
router.get('/internal/:id', asyncHandler(getUserById));

// Protected routes
router.get('/profile', authenticate, asyncHandler(getProfile));

export default router;
