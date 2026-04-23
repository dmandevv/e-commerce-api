// ─── Authentication ─────────────────────────────────────
export interface JwtPayload {
  id: string;
  role: 'customer' | 'admin';
  jti: string; //unique JWT id - used for revocation
  iat: number;
  exp: number;
}

// ─── User ───────────────────────────────────────────────
export interface IUser {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

// ─── Product ────────────────────────────────────────────
export interface IProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  images: Array<{ publicId: string; url: string }>;
  rating: number;
  numOfReviews: number;
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
}

export interface IOrder {
  id: string;
  userId: string;
  items: IOrderItem[];
  total: number;
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
