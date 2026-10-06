import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isOAuthExpired,
  ensureValidOAuthToken,
  refreshOAuthToken,
  pollDeviceToken,
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
    it('posts refresh_token grant to token endpoint', async () => {

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
      expect(String(init.body)).toContain(`client_id=${environments.OAUTH_CLIENT_ID}`);

      vi.unstubAllGlobals();
    });
  });

  describe('pollDeviceToken', () => {
    const device = {
      device_code: 'device-123',
      user_code: 'BCDFGHJK',
      verification_uri: 'https://dashboard.sandbox.hit-pay.com/oauth/device',
      expires_in: 600,
      interval: 5,
    };

    function errorResponse(error: string, status = 400) {
      return { ok: false, status, text: async () => JSON.stringify({ error }) };
    }


    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('keeps polling while pending, backs off on slow_down, then returns tokens', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(errorResponse('authorization_pending'))
        .mockResolvedValueOnce(errorResponse('slow_down'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'a', refresh_token: 'r', expires_in: 3600 }),
        });
      vi.stubGlobal('fetch', fetchMock);
      const sleep = vi.fn().mockResolvedValue(undefined);

      const tokens = await pollDeviceToken('sandbox', device, sleep);

      expect(tokens.access_token).toBe('a');
      expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([5000, 5000, 10000]);
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(String(init.body)).toContain(
        'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code',
      );
      expect(String(init.body)).toContain('device_code=device-123');
    });

    it('fails when the user denies access', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse('access_denied', 401)));

      await expect(pollDeviceToken('sandbox', device, async () => {})).rejects.toThrow(
        'Login was denied in the browser.',
      );
    });

    it('fails when the code expires', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse('expired_token')));

      await expect(pollDeviceToken('sandbox', device, async () => {})).rejects.toThrow(
        'The login code expired',
      );
    });
  });
});
