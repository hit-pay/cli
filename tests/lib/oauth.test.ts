import { describe, it, expect } from 'vitest';
import { parseLoginEnvironment } from '../../src/lib/auth/oauth.js';

describe('parseLoginEnvironment', () => {
  it('accepts all supported environments', () => {
    expect(parseLoginEnvironment('local')).toBe('local');
    expect(parseLoginEnvironment('staging')).toBe('staging');
    expect(parseLoginEnvironment('sandbox')).toBe('sandbox');
    expect(parseLoginEnvironment('production')).toBe('production');
  });

  it('rejects unknown environments', () => {
    expect(() => parseLoginEnvironment('qa')).toThrow(/Environment must be one of/);
  });
});
