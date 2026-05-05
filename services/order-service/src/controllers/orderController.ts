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
