import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isOAuthExpired,
  ensureValidOAuthToken,
  refreshOAuthToken,
} from '../../src/lib/auth/token-manager.js';
import * as environments from '../../src/lib/hitpay/environments.js';

describe('token-manager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isOAuthExpired', () => {
    it('returns true when token expires within refresh buffer', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(
        isOAuthExpired({
          access_token: 'a',
          refresh_token: 'r',
          expires_at: now + 100,
          token_type: 'Bearer',
        }),
      ).toBe(true);
    });

    it('returns false when token expires outside refresh buffer', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(
        isOAuthExpired({
          access_token: 'a',
          refresh_token: 'r',
          expires_at: now + 3600,
          token_type: 'Bearer',
        }),
      ).toBe(false);
    });
  });

  describe('ensureValidOAuthToken', () => {
    it('returns existing access token when not expired', async () => {
      const now = Math.floor(Date.now() / 1000);
      const config = {
        environment: 'sandbox' as const,
        profiles: {
          sandbox: {
            oauth: {
              access_token: 'valid-token',
              refresh_token: 'refresh',
              expires_at: now + 3600,
              token_type: 'Bearer' as const,
            },
          },
        },
      };

      const result = await ensureValidOAuthToken('sandbox', config);
      expect(result.accessToken).toBe('valid-token');
    });

    it('throws when oauth tokens are missing', async () => {
      await expect(
        ensureValidOAuthToken('sandbox', { environment: 'sandbox', profiles: { sandbox: {} } }),
      ).rejects.toThrow(/Not authenticated for sandbox/);
    });
  });

  describe('refreshOAuthToken', () => {
    it('throws when oauth client id is missing', async () => {
      vi.spyOn(environments, 'hasOAuthClientId').mockReturnValue(false);

      await expect(
        refreshOAuthToken('sandbox', {
          access_token: 'a',
          refresh_token: 'r',
          expires_at: 1,
          token_type: 'Bearer',
        }),
      ).rejects.toThrow(/OAuth is not configured/);
    });

    it('posts refresh_token grant to token endpoint', async () => {
      vi.spyOn(environments, 'getOAuthClientId').mockReturnValue('cli-client-id');
      vi.spyOn(environments, 'hasOAuthClientId').mockReturnValue(true);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 3600,
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const tokens = await refreshOAuthToken('sandbox', {
        access_token: 'old',
        refresh_token: 'old-refresh',
        expires_at: 1,
        token_type: 'Bearer',
      });

      expect(tokens.access_token).toBe('new-access');
      expect(tokens.refresh_token).toBe('new-refresh');

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.sandbox.hit-pay.com/v1/open/oauth/token');
      expect(init.method).toBe('POST');
      expect(String(init.body)).toContain('grant_type=refresh_token');
      expect(String(init.body)).toContain('client_id=cli-client-id');

      vi.unstubAllGlobals();
    });
  });
});
