import { z } from '@ecommerce/shared';

export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(30, 'Name cannot exceed 30 characters'),
  email: z.email('Please provide a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const loginSchema = z.object({
  email: z.email('Please provide a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.email('Please provide a valid email'),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
