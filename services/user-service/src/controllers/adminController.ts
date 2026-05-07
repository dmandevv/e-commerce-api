import { Request, Response } from 'express';
import { User } from '../models/User.js';
import { config } from '../config/index.js';
import { NotFoundError, ValidationError, ForbiddenError } from '@ecommerce/shared/errors';

// ─── Admin: List All Users ──────────────────────────────
export const listUsers = async (req: Request, res: Response): Promise<void> => {
  // 1. Parse query params
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);

  // whitelists allowed sort fields so an attacker can't sort by password
  const sortBy = ['name', 'email'].includes(req.query.sortBy as string)
    ? (req.query.sortBy as string)
    : 'createdAt';
  
  // Mongoose uses 1 for ascending, -1 for descending
  const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

  const role = req.query.role as string | undefined;
  const locked = req.query.locked == 'true';
  const createdAfter = req.query.createdAfter as string | undefined;
  const createdBefore = req.query.createdBefore as string | undefined;

  // 2. Build filter
  const filter: Record<string, unknown> = {};

  if (role === 'customer' || role === 'admin') {
    filter.role = role;
  }

  if (locked) {
    filter.lockedUntil = { $gt: new Date() };
  }

  if (createdAfter || createdBefore) {
    filter.createdAt = {
      ...(createdAfter && { $gte: new Date(createdAfter) }),
      ...(createdBefore && { $lte: new Date(createdBefore) }),
    };
  }

  // 3. Database query
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-password -addresses -failedLoginAttempts')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      users,
      total,
      page,
      pages: Math.ceil(total / limit),
    },
  });
};

// ─── Admin: Update User Role ────────────────────────────
export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { role } = req.body;

  if (role !== 'customer' && role !== 'admin') {
    throw new ValidationError('Role must be customer or admin');
  }

  if (req.user!.id === id && role !== 'admin') {
    throw new ForbiddenError('You cannot remove your own admin role');
  }

  const user = await User.findByIdAndUpdate(
    id,
    { role },
    { new: true }
  );

  if (!user) throw new NotFoundError('User');

  res.status(200).json({
    success: true,
    data: { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
  });

};

// ─── Admin: Delete User ─────────────────────────────────
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const target = await User.findById(id);
  if (!target) throw new NotFoundError('User');

  if (target.role === 'admin') {
    throw new ForbiddenError('Cannot delete an admin account');
  }

  if (req.user!.id === id) {
    throw new ForbiddenError('Cannot delete your own account');
  }

  await User.findByIdAndDelete(id);

  res.status(200).json({ success: true, message: 'User deleted' });

};

// ─── Admin: Stats ───────────────────────────────────────
export const getAdminStats = async (_req: Request, res: Response): Promise<void> => {
  const [total, admins, locked, orderStats] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'admin' }),
    User.countDocuments({ lockedUntil: { $gt: new Date() } }),
    fetch(`${config.orderServiceUrl}/api/orders/internal/stats`).then((r) => r.json()),
  ]);

  res.status(200).json({
    success: true,
    data: {
      users: { total, admins, locked },
      orders: { total: orderStats.data.total, byStatus: orderStats.data.byStatus },
      revenue: { total: orderStats.data.revenue },
    },
  });
};
