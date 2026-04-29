/**
 * Single-use token generation for email verification and password reset.
 *
 * Pattern: server generates random token, hashes it, sends RAW via email,
 * stores HASH in DB. When user clicks the link, server hashes their token
 * and looks it up by hash. A DB leak doesn't reveal working tokens.
 *
 * Same principle as password hashing, applied to one-time-use tokens.
 */

import { randomBytes, createHash } from "crypto";

export interface GeneratedToken {
    raw: string;    // 64-char hex — embed in URL, send via email
    hashed: string; // 64-char hex — store in DB, look up by this
}

/**
 * Generate a new token pair. Caller uses:
 *   - raw: include in email link, then discard from memory
 *   - hashed: store in the database
 */
export function generateToken(): GeneratedToken {
  const raw = randomBytes(32).toString('hex');
  const hashed = hashToken(raw);
  return { raw, hashed };
}

/**
 * Hash a raw token. Used when verifying an incoming raw token from a clicked
 * link — hash the input, look it up in the DB by hash.
 */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}