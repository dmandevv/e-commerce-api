import { Request, Response } from 'express';
import { cartRepository } from '../repositories/cartRepository.js';

// ─── Get Cart ───────────────────────────────────────────
export const getCart = async (req: Request, res: Response): Promise<void> => {
  const cart = await cartRepository.getCart(req.user!.id);

  res.status(200).json({ success: true, data: cart });
};

// ─── Add Item to Cart ───────────────────────────────────
export const addItem = async (req: Request, res: Response): Promise<void> => {
  const { productId, name, price, quantity, image } = req.body;

  const cart = await cartRepository.addItem(req.user!.id, {
    productId,
    name,
    price,
    quantity,
    image: image || '',
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
