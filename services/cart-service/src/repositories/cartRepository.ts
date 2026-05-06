import { createClient, type RedisClientType } from 'redis';
import { createLogger } from '@ecommerce/shared/logger';
import { config } from '../config/index.js';
import type { ICart, ICartItem } from '@ecommerce/shared/types';

const logger = createLogger('cart-service');

export class CartRepository {
  private client: RedisClientType;

  constructor() {
    this.client = createClient({ url: config.redisUrl });

    this.client.on('error', (err: any) => {
      logger.error({ err }, 'Redis error');
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
    logger.info('Redis connected');
  }

  // ─── Key format: "cart:{userId}" ────────────────────────
  private key(userId: string): string {
    return `cart:${userId}`;
  }

  // ─── Get full cart ──────────────────────────────────────
  async getCart(userId: string): Promise<ICart> {
    const data = await this.client.get(this.key(userId));

    if (!data) {
      return { userId, items: [], total: 0 };
    }

    return JSON.parse(data);
  }

  // ─── Save cart + reset TTL ──────────────────────────────
  private async saveCart(cart: ICart): Promise<void> {
    await this.client.set(
      this.key(cart.userId),
      JSON.stringify(cart),
      { EX: config.cartTtl }
    );
  }

  // ─── Recalculate total ────────────────────────────────
  private calculateTotal(items: ICartItem[]): number {
    return Math.round(
      items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100
    ) / 100;
  }

  // ─── Add or update item ─────────────────────────────────
  async addItem(userId: string, item: ICartItem): Promise<ICart> {
    const cart = await this.getCart(userId);

    const existingIndex = cart.items.findIndex(
      (i) => i.variantId === item.variantId
    );

    if (existingIndex >= 0) {
      // Item exists — update quantity
      cart.items[existingIndex].quantity += item.quantity;
    } else {
      // New item
      cart.items.push(item);
    }

    cart.total = this.calculateTotal(cart.items);
    await this.saveCart(cart);
    return cart;
  }

  // ─── Update item quantity ───────────────────────────────
  async updateQuantity(userId: string, variantId: string, quantity: number): Promise<ICart> {
    const cart = await this.getCart(userId);

    const item = cart.items.find((i) => i.variantId === variantId);
    if (!item) {
      throw new Error('Item not found in cart');
    }

    item.quantity = quantity;
    cart.total = this.calculateTotal(cart.items);
    await this.saveCart(cart);
    return cart;
  }

  // ─── Remove item ───────────────────────────────────────
  async removeItem(userId: string, variantId: string): Promise<ICart> {
    const cart = await this.getCart(userId);

    cart.items = cart.items.filter((i) => i.variantId !== variantId);
    cart.total = this.calculateTotal(cart.items);
    await this.saveCart(cart);
    return cart;
  }

  // ─── Clear entire cart ─────────────────────────────────
  async clearCart(userId: string): Promise<void> {
    await this.client.del(this.key(userId));
  }
}

// Singleton instance — one connection shared across all requests
export const cartRepository = new CartRepository();
