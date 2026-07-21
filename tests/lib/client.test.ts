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

import { HitPayClient } from '../../src/lib/hitpay/client.js';
import { createClient } from '../../src/lib/client.js';
import { writeConfig } from '../../src/lib/config.js';
import * as tokenManager from '../../src/lib/auth/token-manager.js';

describe('HitPayClient auth headers', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"status":"ok"}',
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends X-BUSINESS-API-KEY for api_key auth', async () => {
    const client = HitPayClient.withApiKey('sk-test-key', 'sandbox');
    await client.get('/v1/account-status');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({
      'X-BUSINESS-API-KEY': 'sk-test-key',
      'X-Requested-With': 'XMLHttpRequest',
    });
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('sends Authorization Bearer for oauth auth', async () => {
    const client = new HitPayClient({
      environment: 'sandbox',
      auth: { method: 'oauth', accessToken: 'oauth-token-xyz' },
    });
    await client.get('/v1/info');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer oauth-token-xyz',
    });
    expect(init.headers).not.toHaveProperty('X-BUSINESS-API-KEY');
  });

  it('uses /v1/info for oauth verifyConnection', async () => {
    const client = new HitPayClient({
      environment: 'sandbox',
      auth: { method: 'oauth', accessToken: 'oauth-token-xyz' },
    });
    await client.verifyConnection();

    const [url] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe('https://api.sandbox.hit-pay.com/v1/info');
  });

  it('uses /v1/account-status for api_key verifyConnection', async () => {
    const client = HitPayClient.withApiKey('sk-test', 'sandbox');
    await client.verifyConnection();

    const [url] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe('https://api.sandbox.hit-pay.com/v1/account-status');
  });
});

describe('createClient', () => {
  beforeEach(() => {
    configFsMock.fileContent = null;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefers api_key over oauth in the same profile', async () => {
    writeConfig({
      environment: 'sandbox',
      profiles: {
        sandbox: {
          api_key: 'sk-priority',
          oauth: {
            access_token: 'oauth-token',
            refresh_token: 'refresh',
            expires_at: 9999999999,
            token_type: 'Bearer',
          },
        },
      },
    });

    const client = await createClient();
    expect(client.authMethod).toBe('api_key');
  });

  it('uses oauth when api_key is absent', async () => {
    writeConfig({
      environment: 'sandbox',
      profiles: {
        sandbox: {
          oauth: {
            access_token: 'oauth-token',
            refresh_token: 'refresh',
            expires_at: 9999999999,
            token_type: 'Bearer',
          },
        },
      },
    });

    vi.spyOn(tokenManager, 'ensureValidOAuthToken').mockResolvedValue({
      accessToken: 'oauth-token',
      config: {},
    });

    const client = await createClient();
    expect(client.authMethod).toBe('oauth');
  });

  it('throws when profile has no credentials', async () => {
    writeConfig({ environment: 'sandbox', profiles: { sandbox: {} } });

    await expect(createClient()).rejects.toThrow(/Not authenticated for sandbox/);
  });

  it('honors --env override without changing stored active environment', async () => {
    writeConfig({
      environment: 'sandbox',
      profiles: {
        sandbox: { api_key: 'sk-sandbox' },
        production: { api_key: 'sk-live' },
      },
    });

    const client = await createClient({ environment: 'production' });
    expect(client.environment).toBe('production');
    expect(client.authMethod).toBe('api_key');
  });
});
