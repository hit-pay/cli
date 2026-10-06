import { describe, it, expect } from 'vitest';
import { bumpVersion } from '../../scripts/release.mjs';

describe('release bumpVersion', () => {
  it('bumps patch version', () => {
    expect(bumpVersion('0.1.0', 'patch')).toBe('0.1.1');
  });

  it('bumps minor version', () => {
    expect(bumpVersion('0.1.0', 'minor')).toBe('0.2.0');
  });

  it('bumps major version', () => {
    expect(bumpVersion('0.1.0', 'major')).toBe('1.0.0');
  });

  it('rejects invalid versions', () => {
    expect(() => bumpVersion('invalid', 'patch')).toThrow('Invalid version');
  });
});
