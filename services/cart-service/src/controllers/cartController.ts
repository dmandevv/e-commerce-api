import { Request, Response } from 'express';
import { cartRepository } from '../repositories/cartRepository.js';
import { config } from '../config/index.js';
import { NotFoundError, ValidationError } from '@ecommerce/shared/errors';

// ─── Get Cart ───────────────────────────────────────────
export const getCart = async (req: Request, res: Response): Promise<void> => {
  const cart = await cartRepository.getCart(req.user!.id);

  res.status(200).json({ success: true, data: cart });
};

// ─── Add Item to Cart ───────────────────────────────────
export const addItem = async (req: Request, res: Response): Promise<void> => {
  const { productId, quantity } = req.body;

  // Fetch the real product from product-service (not trusting client data)
  const productRes = await fetch(`${config.productServiceUrl}/api/products/${productId}`);
  if (!productRes.ok) {
    throw new NotFoundError('Product');
  }

  const { data: product } = await productRes.json();

  if (product.stock < quantity) {
    throw new ValidationError(`Only ${product.stock} items in stock`);
  }

  const cart = await cartRepository.addItem(req.user!.id, {
    productId,
    name: product.name,
    price: product.price,
    quantity,
    image: product.images?.[0]?.url || '',
  });

  res.status(200).json({ success: true, data: cart });
};

// ─── Update Item Quantity ───────────────────────────────
export const updateQuantity = async (req: Request<{ productId: string }>, res: Response): Promise<void> => {
  const { productId } = req.params;
  const { quantity } = req.body;

  const cart = await cartRepository.updateQuantity(
    req.user!.id,
    productId,
    quantity
  );

  res.status(200).json({ success: true, data: cart });
};

// ─── Remove Item from Cart ──────────────────────────────
export const removeItem = async (req: Request<{ productId: string }>, res: Response): Promise<void> => {
  const { productId } = req.params;

  const cart = await cartRepository.removeItem(req.user!.id, productId);

  res.status(200).json({ success: true, data: cart });
};

// ─── Clear Cart ─────────────────────────────────────────
export const clearCart = async (req: Request, res: Response): Promise<void> => {
  await cartRepository.clearCart(req.user!.id);

  res.status(200).json({ success: true, message: 'Cart cleared' });
};
