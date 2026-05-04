// ─── Authentication ─────────────────────────────────────
export interface JwtPayload {
  id: string;
  role: 'customer' | 'admin';
  jti: string; //unique JWT id - used for revocation
  iat: number;
  exp: number;
}

// ─── User ───────────────────────────────────────────────
export interface IAddress {
  id: string;
  label: string; // e.g. "Home", "Work"
  street: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface IUser {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'admin';
  addresses: IAddress[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Product ────────────────────────────────────────────
export interface IProductVariant {
  id: string;
  sku: string;
  attributes: { size?: string; color?: string; [key: string]: string | undefined }; //e.g. { size: "M", material: "cotton" }
  stock: number;
  reservedStock: number; // units held during pending payments
  price?: number; // overrides base price when set
}

export interface IProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  images: Array<{ publicId: string; url: string }>;
  rating: number;
  numOfReviews: number;
  variants: [IProductVariant, ...IProductVariant[]];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Cart ───────────────────────────────────────────────
export interface ICartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  variantId: string;
}

export interface ICart {
  userId: string;
  items: ICartItem[];
  total: number;
}

// ─── Order ──────────────────────────────────────────────
export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered';

export interface IOrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  variantId: string;
}

export interface IOrder {
  id: string;
  userId: string;
  items: IOrderItem[];
  total: number;
  shippingAddress: {
    name: string;
    street: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  }
  status: OrderStatus;
  stripePaymentId: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── API Response ───────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}
