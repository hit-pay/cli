import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const configFsMock = vi.hoisted(() => ({
  fileContent: null as string | null,
}));

vi.mock('node:fs', () => ({
  existsSync: () => configFsMock.fileContent !== null,
  readFileSync: () => configFsMock.fileContent ?? '',
  writeFileSync: (_path: string, data: string) => {
    configFsMock.fileContent = data;
  },
  mkdirSync: vi.fn(),
  chmodSync: vi.fn(),
}));

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    homedir: () => '/mock/hitpay-home',
  };
});

import {
  readConfig,
  writeConfig,
  setGlobalValue,
  setProfileValue,
  setProfileOAuth,
  unsetProfileValue,
  clearProfileAuth,
  getConfigValue,
  resolveEnvironment,
  maskSecret,
  migrateConfigForTest,
} from '../../src/lib/config.js';

function loadStoredConfig() {
  if (!configFsMock.fileContent) return {};
  return JSON.parse(configFsMock.fileContent);
}

describe('Config file store', () => {
  beforeEach(() => {
    configFsMock.fileContent = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty config when file is missing', () => {
    expect(readConfig()).toEqual({});
  });

  it('migrates legacy flat config on read', () => {
    configFsMock.fileContent = JSON.stringify({
      environment: 'sandbox',
      api_key: 'sk-legacy',
    });

    const config = readConfig();
    expect(config.profiles?.sandbox?.api_key).toBe('sk-legacy');
    expect(config.api_key).toBeUndefined();
  });

  it('setProfileValue stores credentials under active environment profile', () => {
    writeConfig({ environment: 'sandbox', profiles: {} });
    setProfileValue('sandbox', 'api_key', 'sk-sandbox');

    const stored = loadStoredConfig();
    expect(stored.profiles.sandbox.api_key).toBe('sk-sandbox');
  });

  it('keeps separate profiles when switching environments', () => {
    writeConfig({
      environment: 'sandbox',
      profiles: {
        sandbox: { api_key: 'sk-sandbox' },
        production: { api_key: 'sk-live' },
      },
    });

    setGlobalValue('environment', 'production');

    const stored = loadStoredConfig();
    expect(stored.environment).toBe('production');
    expect(stored.profiles.sandbox.api_key).toBe('sk-sandbox');
    expect(stored.profiles.production.api_key).toBe('sk-live');
  });

  it('setProfileOAuth sets tokens and defaults active environment', () => {
    setProfileOAuth('staging', {
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      expires_at: 9999999999,
      token_type: 'Bearer',
    });

    const stored = loadStoredConfig();
    expect(stored.environment).toBe('staging');
    expect(stored.profiles.staging.oauth.access_token).toBe('access-1');
  });

  it('unsetProfileValue removes a profile field', () => {
    writeConfig({
      environment: 'sandbox',
      profiles: { sandbox: { api_key: 'sk-x', salt: 's' } },
    });

    unsetProfileValue('sandbox', 'api_key');

    const stored = loadStoredConfig();
    expect(stored.profiles.sandbox.api_key).toBeUndefined();
    expect(stored.profiles.sandbox.salt).toBe('s');
  });

  it('clearProfileAuth removes oauth and optionally api_key', () => {
    writeConfig({
      environment: 'sandbox',
      profiles: {
        sandbox: {
          api_key: 'sk-x',
          salt: 's',
          oauth: {
            access_token: 'a',
            refresh_token: 'r',
            expires_at: 1,
            token_type: 'Bearer',
          },
        },
      },
    });

    clearProfileAuth('sandbox', false);
    let stored = loadStoredConfig();
    expect(stored.profiles.sandbox.oauth).toBeUndefined();
    expect(stored.profiles.sandbox.api_key).toBe('sk-x');

    clearProfileAuth('sandbox', true);
    stored = loadStoredConfig();
    expect(stored.profiles.sandbox).toBeUndefined();
  });

  it('writeConfig strips deprecated root api_key and salt', () => {
    writeConfig({
      environment: 'sandbox',
      api_key: 'legacy',
      salt: 'legacy-salt',
      profiles: { sandbox: { api_key: 'sk-new' } },
    });

    const stored = loadStoredConfig();
    expect(stored.api_key).toBeUndefined();
    expect(stored.salt).toBeUndefined();
  });

  it('getConfigValue reads global and profile keys', () => {
    writeConfig({
      environment: 'production',
      currency: 'SGD',
      profiles: {
        production: { api_key: 'sk-live' },
      },
    });

    expect(getConfigValue('environment')).toBe('production');
    expect(getConfigValue('currency')).toBe('SGD');
    expect(getConfigValue('api_key')).toBe('sk-live');
    expect(getConfigValue('api_key', 'production')).toBe('sk-live');
  });

  it('resolveEnvironment uses override, config, then production default', () => {
    expect(resolveEnvironment({}, undefined)).toBe('production');
    expect(resolveEnvironment({ environment: 'production' }, undefined)).toBe('production');
    expect(resolveEnvironment({ environment: 'production' }, 'staging')).toBe('staging');
  });

  it('resolveEnvironment rejects invalid values', () => {
    expect(() => resolveEnvironment({}, 'invalid')).toThrow(/Invalid environment/);
  });

  it('maskSecret hides middle of long values', () => {
    expect(maskSecret('sk-sandbox-abcdefghijklmnop')).toBe('sk-sandb...mnop');
    expect(maskSecret('short')).toBe('*****');
  });
});

describe('migrateConfigForTest', () => {
  it('creates empty profiles object when no legacy credentials exist', () => {
    expect(migrateConfigForTest({ environment: 'sandbox' })).toEqual({
      environment: 'sandbox',
      profiles: {},
    });
  });
});
