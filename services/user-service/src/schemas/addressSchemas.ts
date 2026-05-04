import { z } from 'zod';

export const createAddressSchema = z.object({
    label: z.string().min(1, 'Label is required').max(15, 'Label cannot exceed 15 characters'),
    street: z.string().min(1, 'Street is required').max(50, 'Street cannot exceed 50 characters'),
    city: z.string().min(1, 'City is required').max(50, 'City cannot exceed 50 characters'),
    province: z.string().min(1, 'Province is required').max(50, 'Province cannot exceed 50 characters'),
    postalCode: z.string().min(1, 'Postal code is required').max(15, 'Postal code cannot exceed 15 characters'),
    country: z.string().min(1, 'Country is required').max(50, 'Country cannot exceed 50 characters').default('Canada'),
    isDefault: z.boolean().default(false),
});

export const updateAddressSchema = createAddressSchema.partial();

// for deleting address
export const addressParamsSchema = z.object({
    addressId: z.string().min(1, 'Address ID is required'),
});