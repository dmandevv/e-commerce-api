import { Request, Response } from 'express';
import * as orderService from '../services/orderService.js';

export const placeOrder = async (req: Request, res: Response): Promise<void> => {
  const token = req.headers.authorization?.split(' ')[1] ?? req.cookies?.accessToken;
  const order = await orderService.placeOrder(req.user!.id, req.body.addressId, token, req.requestId);

  res.status(201).json({ success: true, data: order });
};

export const getOrder = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const order = await orderService.getOrderById(req.params.id, req.user!.id);

  res.status(200).json({ success: true, data: order });
};

export const getMyOrders = async (req: Request, res: Response): Promise<void> => {
  const orders = await orderService.getUserOrders(req.user!.id);

  res.status(200).json({ success: true, data: orders });
};

export const updateStatus = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const order = await orderService.updateOrderStatus(req.params.id, req.body.status);

  res.status(200).json({ success: true, data: order });
};

export const getAllOrders = async (req: Request, res: Response): Promise<void> => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const sortBy = ['createdAt', 'total'].includes(req.query.sortBy as string)
    ? (req.query.sortBy as string)
    : 'createdAt';
  const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';
  const status = req.query.status as string | undefined;
  const userId = req.query.userId as string | undefined;
  const createdAfter = req.query.createdAfter as string | undefined;
  const createdBefore = req.query.createdBefore as string | undefined;

  const result = await orderService.getAllOrders({
    page, limit, sortBy, sortOrder, status, userId, createdAfter, createdBefore,
  });

  res.status(200).json({ success: true, data: result });
};

export const getOrderStats = async (_req: Request, res: Response): Promise<void> => {
  const stats = await orderService.getOrderStats();
  res.status(200).json({ success: true, data: stats });
};
