import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { generateOAuthState, generatePkce } from '../../src/lib/auth/pkce.js';

describe('PKCE helpers', () => {
  it('generates verifier/challenge pair where challenge is S256 of verifier', () => {
    const { verifier, challenge } = generatePkce();

    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'));
  });

  it('generates unique PKCE pairs', () => {
    const a = generatePkce();
    const b = generatePkce();
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.challenge).not.toBe(b.challenge);
  });

  it('generates hex OAuth state', () => {
    const state = generateOAuthState();
    expect(state).toMatch(/^[0-9a-f]{32}$/);
    expect(generateOAuthState()).not.toBe(state);
  });
});
