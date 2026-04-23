import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { randomUUID } from 'crypto';
import { RefreshToken } from '../models/RefreshToken.js';
import { config } from '../config/index.js';

// ─── Access Token ───────────────────────────────────────
// Short-lived JWT. Contains user id + role (claims).
// Used by services to identify the user on each request.
export function signAccessToken(userId: string, role: string): string {
  return jwt.sign(
    { id: userId, role, jti: randomUUID() }, 
    config.jwtSecret,
    { expiresIn: config.accessTokenExpiresIn as StringValue }
  );
}

// ─── Refresh Token ──────────────────────────────────────
// Opaque random string stored in MongoDB (not a JWT).
// Only valid if it exists in DB and isn't revoked.
export async function issueRefreshToken(
  userId: string,
  family?: string
): Promise<string> {
  const token = randomUUID();
  const expiresAt = new Date(
    Date.now() + config.refreshTokenExpiresInDays * 24 * 60 * 60 * 1000
  );

  await RefreshToken.create({
    token,
    userId,
    family: family || randomUUID(), // new family on fresh login
    expiresAt,
    revoked: false,
  });

  return token;
}

// ─── Rotate Refresh Token ───────────────────────────────
// Used when a valid refresh token is presented to /refresh.
// Revokes the old token, issues a new one in the same family.
// If the incoming token is ALREADY revoked → theft detected,
// revoke the entire family.
export async function rotateRefreshToken(
  incomingToken: string
): Promise<{ userId: string; newToken: string } | null> {
  const record = await RefreshToken.findOne({ token: incomingToken });

  if (!record) return null;              // token doesn't exist
  if (record.expiresAt < new Date()) return null; // expired

  if (record.revoked) {
    // REUSE DETECTED — nuke the whole family
    await RefreshToken.updateMany(
      { family: record.family },
      { revoked: true }
    );
    return null;
  }

  // Happy path: revoke old, issue new in same family
  record.revoked = true;
  await record.save();

  const newToken = await issueRefreshToken(record.userId, record.family);
  return { userId: record.userId, newToken };
}

// ─── Revoke Family (used on logout) ─────────────────────
export async function revokeFamily(token: string): Promise<void> {
  const record = await RefreshToken.findOne({ token });
  if (!record) return;
  await RefreshToken.updateMany(
    { family: record.family },
    { revoked: true }
  );
}
