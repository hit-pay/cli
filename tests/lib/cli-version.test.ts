import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import { CLI_PACKAGE_NAME } from '../../src/lib/package-meta.js';
import {
  compareVersions,
  getCurrentVersion,
  isNewerVersion,
} from '../../src/lib/cli-version.js';

const require = createRequire(import.meta.url);
const { name: packageName } = require('../../package.json') as { name: string };

describe('cli-version', () => {
  it('reads current version from package.json', () => {
    expect(getCurrentVersion()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('keeps package.json name in sync with package-meta', () => {
    expect(packageName).toBe(CLI_PACKAGE_NAME);
  });

  it('compares semver versions', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('1.2.4', '1.2.3')).toBe(1);
    expect(compareVersions('1.2.3', '1.3.0')).toBe(-1);
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
  });

  it('detects newer versions', () => {
    expect(isNewerVersion('0.2.0', '0.1.0')).toBe(true);
    expect(isNewerVersion('0.1.0', '0.1.0')).toBe(false);
    expect(isNewerVersion('0.1.0', '0.2.0')).toBe(false);
  });

  it('rejects invalid version strings', () => {
    expect(() => compareVersions('invalid', '1.0.0')).toThrow('Invalid version');
  });
});
