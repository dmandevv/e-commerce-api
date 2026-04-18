import { Request, Response } from 'express';
import { User } from '../models/User.js';
import { config } from '../config/index.js';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
} from '@ecommerce/shared/errors';
import type { ApiResponse, IUser } from '@ecommerce/shared/types';
import { signAccessToken, issueRefreshToken, rotateRefreshToken, revokeFamily } from '../lib/tokens.js';

function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  // Access token — readable by all services (so they can authenticate requests)
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000, // 15 min
    path: '/',
  });

  // Refresh token — only sent to /api/users/refresh and /api/users/logout
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    maxAge: config.refreshTokenExpiresInDays * 24 * 60 * 60 * 1000,
    path: '/api/users',
  });
}


// ─── Register ───────────────────────────────────────────
export const register = async (req: Request, res: Response): Promise<void> => {
  const { name, email, password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ConflictError('User already exists');
  }

  const user = await User.create({ name, email, password, role: 'customer' });
  
  const accessToken = signAccessToken(user._id.toString(), user.role);
  const refreshToken = await issueRefreshToken(user._id.toString());
  setAuthCookies(res, accessToken, refreshToken);

  // TODO: publish USER_REGISTERED event to RabbitMQ (Step 5)

  const response: ApiResponse<{ user: Partial<IUser> }> = {
    success: true,
    data: {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
  };

  res.status(201).json(response);
};

// ─── Login ──────────────────────────────────────────────
export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new UnauthorizedError('Invalid credentials');
  }

  // check if account has been locked
  if (user.lockedUntil) {
    const minsLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    if (minsLeft > 0) {
      throw new UnauthorizedError(`Account Locked. Try again in ${minsLeft} minutes(s)`);
    }
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= config.maxLoginAttempts) {
      user.lockedUntil = new Date(Date.now() + (config.lockoutDurationMinutes * 60_000));
    }
    await user.save();
    throw new UnauthorizedError('Invalid credentials');
  }

  //successful login - reset login attempts
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  await user.save();

  const accessToken = signAccessToken(user._id.toString(), user.role);
  const refreshToken = await issueRefreshToken(user._id.toString());  // ← writes to mongoDB
  setAuthCookies(res, accessToken, refreshToken);

  const response: ApiResponse<{ user: Partial<IUser> }> = {
    success: true,
    data: {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
  };

  res.status(200).json(response);
};

// ─── Internal: Get User by ID (service-to-service, no auth) ─
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new NotFoundError('User');
  }

  res.status(200).json({
    success: true,
    data: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
    },
  });
};

// ─── Get Profile ────────────────────────────────────────
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  const user = await User.findById(req.user?.id);
  if (!user) {
    throw new NotFoundError('User');
  }

  const response: ApiResponse<Partial<IUser>> = {
    success: true,
    data: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
  };

  res.status(200).json(response);
};
