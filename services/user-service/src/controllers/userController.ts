import { Request, Response } from 'express';
import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { config } from '../config/index.js';
import { ConflictError, UnauthorizedError, NotFoundError, ValidationError, ForbiddenError } from '@ecommerce/shared/errors';
import type { ApiResponse, IUser, JwtPayload } from '@ecommerce/shared/types';
import { signAccessToken, issueRefreshToken, rotateRefreshToken, revokeFamily } from '../lib/tokens.js';
import { issueCsrfToken } from '@ecommerce/shared/middleware';
import jwt from 'jsonwebtoken';
import { blacklist } from '../lib/blacklist.js';
import { createVerificationToken, consumeVerificationToken } from '../lib/verificationToken.js';
import { publishEvent } from '../events/publisher.js';
import { EventNames } from '@ecommerce/shared/events';
import type { PasswordResetRequestedEvent, UserRegisteredEvent } from '@ecommerce/shared/events';

import { createLogger } from '@ecommerce/shared/logger';
const logger = createLogger('user-service');

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

  issueCsrfToken(res, { secure: config.cookieSecure });
}


// ─── Register ───────────────────────────────────────────
export const register = async (req: Request, res: Response): Promise<void> => {
  const { name, email, password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ConflictError('User already exists');
  }

  const user = await User.create({
    name, email, password, role: 'customer',
    // Skip email verification outside production so staging/dev smoke tests
    // and local development work without needing a real email flow.
    emailVerified: process.env.EMAIL_VERIFY !== 'true',
  });

  // Create email verification token. The raw value goes to notification-service
  // via RabbitMQ event. User can't log in until they consume it.
  const verificationToken = await createVerificationToken(
    user._id.toString(),
    'email-verification'
  );

  // publish USER_REGISTERED event with verificationToken
  await publishEvent(EventNames.USER_REGISTERED, {
    userId: user._id.toString(),
    email: user.email,
    name: user.name,
    verificationToken: verificationToken,
    timestamp: new Date(),
  } satisfies UserRegisteredEvent);

  const accessToken = signAccessToken(user._id.toString(), user.role);
  const refreshToken = await issueRefreshToken(user._id.toString());
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
  
  // block unverified users (after password is confirmed correct)
  if (!user.emailVerified) {
    throw new ForbiddenError('Please verify your email before logging in');
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
      addresses: user.addresses,
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
      addresses: user.addresses.map((a) => ({
        id: a._id.toString(),
        label: a.label,
        street: a.street,
        city: a.city,
        province: a.province,
        postalCode: a.postalCode,
        country: a.country,
        isDefault: a.isDefault,
      })),
      createdAt: user.createdAt,
    },
  };

  res.status(200).json(response);
};

// ─── Refresh Tokens ─────────────────────────────────────
export const refresh = async (req: Request, res: Response): Promise<void> => {
  const incomingToken = req.cookies?.refreshToken;
  if (!incomingToken) {
    throw new UnauthorizedError('No refresh token provided');
  }

  const result = await rotateRefreshToken(incomingToken);
  if (!result) {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/api/users' });
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  //re-fetch - users role could have changed or have been deleted
  const user = await User.findById(result.userId);
  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  const accessToken = signAccessToken(result.userId, user.role);
  setAuthCookies(res, accessToken, result.newToken);

  res.status(200).json({ success: true });
}

// ─── Logout ─────────────────────────────────────────────
export const logout = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies?.refreshToken;
  const accessToken = req.cookies?.accessToken;

  // Defense-in-depth. If a user logs out, we want every outstanding 
  // refresh token in their session chain dead — not just the current one. 
  // In practice it's usually the same thing, but if some edge case left a 
  // sibling token alive, revoking the family guarantees cleanup.
  if (refreshToken) {
    await revokeFamily(refreshToken);
  }

  // 2. Blacklist the current access token (kills the current 15-min window)
  // Verify so we don't blacklist a forged/expired token — they're harmless already.
  if (accessToken) {
    try {
      const decoded = jwt.verify(accessToken, config.jwtSecret) as JwtPayload;
      const ttl = decoded.exp - Math.floor(Date.now() / 1000); // JWT exp is a Unix timestamp in seconds. Date.now() is milliseconds.
      if (ttl > 0 && decoded.jti) { //token isn't expired and isn't a legacy token without jti (defensive strategy)
        await blacklist.blacklistToken(decoded.jti, ttl);
      }
    } catch (err) {
      // Verify failure = token already invalid/expired -> nothing to revoke.
      // Blacklist write failure = Redis down -> log loudly; cookies still clear.
      logger.error({ err }, 'Access-token revocation failed');
    }
  }

  // Always clear cookies (safe even if they weren't set)
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/api/users' });
  res.clearCookie('csrfToken', { path: '/' });

  res.status(200).json({ success: true });
}

export const getCsrfToken = async (_req: Request, res: Response): Promise<void> => {
  issueCsrfToken(res, { secure: config.cookieSecure });
  res.status(204).end();
}


// ─── Verify Email ───────────────────────────────────────
// PUBLIC endpoint — clicked from email link. Consumes the token atomically
// and flips emailVerified to true.
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params;

  if (!token) {
    throw new ValidationError('Token is required');
  }

  const userId = await consumeVerificationToken(token as string, 'email-verification');
  if (!userId) {
    throw new ValidationError('Invalid or expired verification link');
  }

  await User.findByIdAndUpdate(userId, { emailVerified: true });

  res.status(200).json({ success: true, message: 'Email verified' });
};


// ─── Request Verification Email (resend) ────────────────
// AUTH-required endpoint. User clicks "didn't get it? resend" button.
export const requestVerificationEmail = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.user!.id;

  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('User not found');
  if (user.emailVerified) {
    // Don't waste an email. Tell the client.
    throw new ConflictError('Email already verified');
  }

  const verificationToken = await createVerificationToken(
    userId,
    'email-verification'
  );

  // TODO (Step 7): publish USER_REGISTERED event with verificationToken
  logger.warn({ verificationToken }, '[DEV] Resent verification link');

  res.status(204).send();
};

// ─── Forgot Password (request reset link) ──────────────
// PUBLIC endpoint. Always returns 200, even if the email doesn't exist —
// this prevents attackers from probing which emails are registered.
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (user) {
    // Only create + send if the user exists. The response shape is
    // identical either way so the client can't tell the difference.
    const resetToken = await createVerificationToken(
      user._id.toString(),
      'password-reset'
    );

    await publishEvent(EventNames.PASSWORD_RESET_REQUESTED, {
      userId: user._id.toString(),
      email: user.email,
      resetToken: resetToken,
      timestamp: new Date(),
    } satisfies PasswordResetRequestedEvent);
  }

  // Same response whether or not the user exists
  res.status(200).json({
    success: true,
    message: 'If an account with that email exists, a password reset link has been sent.',
  });
};

// ─── Reset Password (consume reset token) ──────────────
// PUBLIC endpoint. Consumes the token, updates the password, and
// invalidates ALL of this user's existing sessions for safety.
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params;
  const { password } = req.body;

  if (!token) throw new ValidationError('Token is required');

  const userId = await consumeVerificationToken(token as string, 'password-reset');
  if (!userId) {
    throw new ValidationError('Invalid or expired reset link');
  }

  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('User');

  // Update password — pre('save') middleware on User auto-hashes it via bcrypt.
  user.password = password;
  await user.save();

  // Security: invalidate ALL existing sessions on password change.
  // This forces re-login from every device — including any attacker who
  // had stolen credentials before this reset.
  await RefreshToken.updateMany({ userId }, { revoked: true });

  res.status(200).json({
    success: true,
    message: 'Password reset successfully. Please log in with your new password.',
  });
};