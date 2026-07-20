import { describe, it, expect } from 'vitest';
import {
  migrateConfigForTest,
  getAuthMethod,
  getProfile,
  maskSecret,
  resolveEnvironment,
} from '../../src/lib/config.js';
import {
  ENVIRONMENT_NAMES,
  getApiBaseUrl,
  getOAuthAuthorizeUrl,
  getOAuthTokenUrl,
  getOAuthClientId,
  hasOAuthClientId,
  isEnvironment,
  OAUTH_LOGIN_SCOPE,
} from '../../src/lib/hitpay/environments.js';

describe('Config migration (pure)', () => {
  it('migrates flat api_key into profiles for active environment', () => {
    const migrated = migrateConfigForTest({
      environment: 'sandbox',
      api_key: 'sk-test-123',
      salt: 'salt-abc',
    });

    expect(migrated.profiles?.sandbox?.api_key).toBe('sk-test-123');
    expect(migrated.profiles?.sandbox?.salt).toBe('salt-abc');
  });

  it('leaves profile-based config unchanged', () => {
    const input = {
      environment: 'production' as const,
      profiles: {
        production: { api_key: 'sk-live' },
        sandbox: {
          oauth: {
            access_token: 't',
            refresh_token: 'r',
            expires_at: 999,
            token_type: 'Bearer' as const,
          },
        },
      },
    };
    expect(migrateConfigForTest(input)).toEqual(input);
  });

  it('resolves auth method with api_key priority', () => {
    expect(
      getAuthMethod({
        api_key: 'sk-xxx',
        oauth: { access_token: 't', refresh_token: 'r', expires_at: 999, token_type: 'Bearer' },
      }),
    ).toBe('api_key');
    expect(
      getAuthMethod({
        oauth: { access_token: 't', refresh_token: 'r', expires_at: 999, token_type: 'Bearer' },
      }),
    ).toBe('oauth');
    expect(getAuthMethod({})).toBeNull();
  });
});

describe('Environments (pure)', () => {
  it('recognizes all planned environments', () => {
    for (const env of ENVIRONMENT_NAMES) {
      expect(isEnvironment(env)).toBe(true);
    }
    expect(isEnvironment('invalid')).toBe(false);
  });

  it('uses hardcoded default API URLs', () => {
    expect(getApiBaseUrl('local')).toBe('https://api.src.test');
    expect(getApiBaseUrl('staging')).toBe('https://api.staging.hit-pay.com');
    expect(getApiBaseUrl('sandbox')).toBe('https://api.sandbox.hit-pay.com');
    expect(getApiBaseUrl('production')).toBe('https://api.hit-pay.com');
  });

  it('builds OAuth URLs from environment definitions', () => {
    expect(getOAuthAuthorizeUrl('sandbox')).toBe(
      'https://dashboard.sandbox.hit-pay.com/oauth/authorize',
    );
    expect(getOAuthTokenUrl('staging')).toBe(
      'https://api.staging.hit-pay.com/v1/open/oauth/token',
    );
    expect(getOAuthTokenUrl('local')).toBe('https://api.src.test/v1/open/oauth/token');
  });

  it('includes hardcoded oauth client ids for every environment', () => {
    for (const env of ENVIRONMENT_NAMES) {
      expect(getOAuthClientId(env)).toBeTruthy();
      expect(hasOAuthClientId(env)).toBe(true);
    }
    expect(getOAuthClientId('sandbox')).toBe('hitpay-cli-sandbox');
    expect(getOAuthClientId('production')).toBe('hitpay-cli-production');
  });

  it('requests business and payment scopes during oauth login', () => {
    expect(OAUTH_LOGIN_SCOPE).toContain('business:read');
    expect(OAUTH_LOGIN_SCOPE).toContain('payments:create');
    expect(OAUTH_LOGIN_SCOPE).toContain('payments:read');
  });
});

describe('Profile lookup (pure)', () => {
  it('returns empty profile when env not configured', () => {
    expect(getProfile({ environment: 'sandbox' }, 'sandbox')).toEqual({});
  });
});

describe('resolveEnvironment (pure)', () => {
  it('defaults to production and accepts overrides', () => {
    expect(resolveEnvironment({})).toBe('production');
    expect(resolveEnvironment({ environment: 'production' }, 'staging')).toBe('staging');
  });

  it('rejects invalid environment names', () => {
    expect(() => resolveEnvironment({}, 'not-real')).toThrow(/Invalid environment/);
  });
});

describe('maskSecret (pure)', () => {
  it('masks long secrets', () => {
    expect(maskSecret('abcdefghijklmnop')).toBe('abcdefgh...mnop');
    expect(maskSecret('tiny')).toBe('****');
  });
});
