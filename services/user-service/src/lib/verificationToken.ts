/**
 * Helpers for single-use email verification + password reset tokens.
 *
 * createVerificationToken — generates a raw token, stores its hash,
 *   invalidates any prior unused tokens for the user+type (so a leaked
 *   stale link can't be used after a fresh one is requested).
 *
 * consumeVerificationToken — atomic compare-and-swap. Either returns the
 *   userId of a fresh, unused, unexpired token, or null. The atomicity
 *   prevents race conditions when a link is clicked concurrently.
 */


import { generateToken, hashToken } from '@ecommerce/shared/middleware';
import {
  VerificationToken,
  type VerificationTokenType,
} from '../models/VerificationToken.js';

// TTLs by token type. Email verification gets a longer window (24h)
// because the legitimate user might not check email immediately.
// Password reset is short (1h) — if you need to reset, you need it now.
const TTL_BY_TYPE: Record<VerificationTokenType, number> = {
  'email-verification': 24 * 60 * 60 * 1000, // 24 hours
  'password-reset':       1 * 60 * 60 * 1000, //  1 hour
};

/**
 * Create a new single-use token. Returns the RAW token (to embed in the email).
 *
 * Side effects:
 *   - Marks all prior unused tokens of the same type for this user as used.
 *     This means requesting a fresh password-reset email immediately
 *     invalidates the previous link, even if it hasn't expired yet.
 */
export async function createVerificationToken(
  userId: string,
  type: VerificationTokenType
): Promise<string> {
  await VerificationToken.updateMany(
    { userId, type, used: false },
    { used: true }
  );

  const { raw, hashed } = generateToken();
  const expiresAt = new Date(Date.now() + TTL_BY_TYPE[type]);

  await VerificationToken.create({
    token: hashed,
    userId,
    type,
    expiresAt,
    used: false,
  });

  return raw;
}

/**
 * Atomically consume a token. Returns userId on success, null if invalid.
 *
 * The query+update is one Mongo round-trip with the equivalent of a
 * compare-and-swap: only matches docs where `used: false` AND not expired,
 * then flips `used: true` in the same operation.
 *
 * Concurrent clicks: only ONE caller succeeds. Others get null.
 */
export async function consumeVerificationToken(
  rawToken: string,
  type: VerificationTokenType
): Promise<string | null> {
  const hashed = hashToken(rawToken);

  const doc = await VerificationToken.findOneAndUpdate(
    {
      token: hashed,
      type,
      used: false,
      expiresAt: { $gt: new Date() },
    },
    { used: true },
    { new: false } // we don't read the post-update doc; just need the match
  );

  return doc ? doc.userId.toString() : null;
}