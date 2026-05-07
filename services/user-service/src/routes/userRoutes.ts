import { Router } from 'express';
import { 
    register, login, getProfile, getUserById, refresh, logout, getCsrfToken, 
    verifyEmail, requestVerificationEmail, forgotPassword, resetPassword
} from '../controllers/userController.js';
import { listUsers, updateUserRole, deleteUser, getAdminStats } from '../controllers/adminController.js';
import { addAddress, updateAddress, deleteAddress} from '../controllers/addressController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, sanitizeBody } from '@ecommerce/shared/middleware';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../schemas/userSchemas.js';
import { createAddressSchema, updateAddressSchema, addressParamsSchema } from '../schemas/addressSchemas.js';

const router = Router();

//CSRF token
router.get('/csrf', asyncHandler(getCsrfToken));

// Public routes
router.post('/register', sanitizeBody, validate(registerSchema), asyncHandler(register));
router.post('/login', validate(loginSchema), asyncHandler(login));
router.post('/refresh', asyncHandler(refresh));
router.post('/logout', asyncHandler(logout));
router.get('/verify-email/:token', asyncHandler(verifyEmail)); // clicked from email
router.post('/forgot-password', validate(forgotPasswordSchema), asyncHandler(forgotPassword));
router.post('/reset-password/:token', validate(resetPasswordSchema), asyncHandler(resetPassword));

// Internal (service-to-service only — not exposed through NGINX,
// so it's unreachable from the internet. Safe to skip auth.)
router.get('/internal/:id', asyncHandler(getUserById));

// Protected routes
router.get('/profile', authenticate, asyncHandler(getProfile));
router.post('/verify-email/request', authenticate, asyncHandler(requestVerificationEmail));
router.post('/addresses', authenticate, validate(createAddressSchema), asyncHandler(addAddress));
router.put('/addresses/:addressId', authenticate, validate(updateAddressSchema), asyncHandler(updateAddress));
router.delete('/addresses/:addressId', authenticate, validate(addressParamsSchema, 'params'), asyncHandler(deleteAddress));

// Admin routes
router.get('/admin', authenticate, authorize('admin'), asyncHandler(listUsers));
router.get('/admin/stats', authenticate, authorize('admin'), asyncHandler(getAdminStats));
router.patch('/admin/:id', authenticate, authorize('admin'), asyncHandler(updateUserRole));
router.delete('/admin/:id', authenticate, authorize('admin'), asyncHandler(deleteUser));


export default router;
