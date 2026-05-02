import { describe, it, expect } from 'vitest';
import { generateToken, hashToken } from './tokenHash.js';

describe('generateToken', () => {
  it('returns a 64-char hex raw token (32 bytes)', () => {
    const { raw } = generateToken();
    expect(raw).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns a 64-char hex hashed token (SHA-256 of raw)', () => {
    const { hashed } = generateToken();
    expect(hashed).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hashed value matches what hashToken(raw) produces — round-trip', () => {
    const { raw, hashed } = generateToken();
    expect(hashToken(raw)).toBe(hashed);
  });

  it('produces a different raw token on each call (randomness check)', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hashed).not.toBe(b.hashed);
  });
});

describe('hashToken', () => {
  it('is deterministic — same input → same output', () => {
    const input = 'some-token-value';
    expect(hashToken(input)).toBe(hashToken(input));
  });

  it('produces different output for different input', () => {
    expect(hashToken('a')).not.toBe(hashToken('b'));
  });
});
