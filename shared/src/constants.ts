// Single source of truth for enums used across services.
// When updating, also sync:
//   - frontend/src/lib/constants.ts (can't import from shared directly)
//   - order-service/prisma/schema.prisma (Prisma can't import from TS)
export const PRODUCT_CATEGORIES = [
  'Electronics',
  'Computers',
  'Smart Home',
  'Arts & Crafts',
  'Automotive',
  'Baby',
  'Beauty & Personal Care',
  'Books',
  'Clothing',
  'Shoes',
  'Jewelry',
  'Food & Grocery',
  'Handmade',
  'Health & Household',
  'Home & Kitchen',
  'Industrial & Scientific',
  'Luggage',
  'Movies & TV',
  'Music',
  'Pet Supplies',
  'Sports & Outdoors',
  'Tools & Home Improvement',
  'Toys & Games',
  'Video Games',
] as const;

export const ORDER_STATUSES = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;
