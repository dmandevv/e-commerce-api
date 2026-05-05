import { z, PRODUCT_CATEGORIES } from '@ecommerce/shared';

const variantSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  attributes: z.record(z.string(), z.string()).default({}),
  stock: z.number().int().min(0).default(0),
  reservedStock: z.number().int().min(0).default(0),
  price: z.number().min(0).optional(),
});


export const createProductSchema = z.object({
  name: z.string().min(1, 'Please enter product name'),
  description: z.string().min(1, 'Please enter product description'),
  price: z.number().min(0, 'Price cannot be negative'),
  category: z.enum(PRODUCT_CATEGORIES, { message: 'Please select correct category' }),
  variants: z.array(variantSchema).min(1, 'Product must have at least one variant'),
  images: z.array(z.object({
    publicId: z.string(),
    url: z.string().url(),
  })).optional(),
});

// .partial() makes every field optional — reuses the same rules for PATCH
export const updateProductSchema = createProductSchema.partial();

export const createReviewSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  comment: z.string().optional(),
  name: z.string().optional(),
});
