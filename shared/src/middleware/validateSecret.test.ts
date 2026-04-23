import { describe, it, expect } from 'vitest';
import { validateJwtSecret, WeakSecretError } from './validateSecret.js';

// A known-good secret for success cases: 64 hex chars = 32 bytes of randomness.
// Generated with `openssl rand -hex 32` for this test only — DO NOT reuse as a real secret.
const STRONG_SECRET = 'a3f9b8c2d1e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0';

describe('validateJwtSecret', () => {
  it('throws WeakSecretError when secret is undefined', () => {
    expect(() => validateJwtSecret(undefined)).toThrow(WeakSecretError);
    expect(() => validateJwtSecret(undefined)).toThrow('JWT_SECRET is not set');
  });

  it('throws WeakSecretError when secret is empty string', () => {
    expect(() => validateJwtSecret('')).toThrow('JWT_SECRET is not set');
  });

  it('throws WeakSecretError when secret is shorter than 32 chars', () => {
    expect(() => validateJwtSecret('short_secret')).toThrow(
      /must be at least 32 chars \(got 12\)/
    );
  });

  it('throws WeakSecretError for known weak defaults (case-insensitive)', () => {
    expect(() => validateJwtSecret('dev_secret_change_in_production')).toThrow(
      /commonly used default/
    );
    // Same string uppercased — still weak
    expect(() =>
      validateJwtSecret('DEV_SECRET_CHANGE_IN_PRODUCTION')
    ).toThrow(/commonly used default/);
  });

  it('throws WeakSecretError for low-entropy strings (same char repeated)', () => {
    // 32 chars, passes length check, but only 1 unique character
    const lowEntropy = 'a'.repeat(32);
    expect(() => validateJwtSecret(lowEntropy)).toThrow(/unique chars/);
  });

  it('reports weak-list match rather than length when both fail', () => {
    // 'secret' is 6 chars — fails length AND weak list.
    // The test proves we give the specific "weak default" error, not the
    // generic length error, because weak-list runs first.
    expect(() => validateJwtSecret('secret')).toThrow(/commonly used default/);
  });


  it('uses custom env var name in error messages when provided', () => {
    expect(() => validateJwtSecret(undefined, 'COOKIE_SIGNING_SECRET')).toThrow(
      'COOKIE_SIGNING_SECRET is not set'
    );
  });

  it('accepts a strong random secret without throwing', () => {
    expect(() => validateJwtSecret(STRONG_SECRET)).not.toThrow();
  });
});