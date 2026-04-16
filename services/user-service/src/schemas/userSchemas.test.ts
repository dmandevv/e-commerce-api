import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from './userSchemas.js';

// ─────────────────────────────────────────────────────────
// registerSchema
// ─────────────────────────────────────────────────────────
describe('registerSchema', () => {
    const validData = {
        name: 'John',
        email: 'test@example.com',
        password: '123456'
    };
    it('should pass valid input', () => {
        const result = registerSchema.safeParse(validData);
        expect(result.success).toBe(true);
    });
    it('should fail if name is missing', () => {
        const result = registerSchema.safeParse({ ...validData, name: '' });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toBe('Name is required');
        }
    });
    it('should fail if name exceeds 30 chars', () => {
        const result = registerSchema.safeParse({ ...validData, name: 'namenamenamenamenamenamenamenamenamenamenamenamenamenamename' });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toBe('Name cannot exceed 30 characters');
        }
    });
    it('should fail if email is invalid format', () => {
        const result = registerSchema.safeParse({ ...validData, email: 'email' });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toBe('Please provide a valid email');
        }
    });
    it('should fail if password is less than 6 chars', () => {
        const result = registerSchema.safeParse({ ...validData, password: '' });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toBe('Password must be at least 6 characters');
        }
    });
});

// ─────────────────────────────────────────────────────────
// loginSchema
// ─────────────────────────────────────────────────────────
describe('loginSchema', () => {
    const validData = {
        email: 'test@example.com',
        password: '123456'
    };
    it('should pass valid input', () => {
        const result = loginSchema.safeParse(validData);
        expect(result.success).toBe(true);
    });
    it('should fail if email is invalid format', () => {
        const result = loginSchema.safeParse({ ...validData, email: 'email' });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toBe('Please provide a valid email');
        }
    });
        it('should fail if password is missing', () => {
        const result = loginSchema.safeParse({ ...validData, password: '' });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toBe('Password is required');
        }
    });
});
