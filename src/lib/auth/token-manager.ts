import {
  type Environment,
  type OAuthCredentials,
  getOAuthDeviceCodeUrl,
  getOAuthTokenUrl,
  OAUTH_CLIENT_ID,
  OAUTH_LOGIN_SCOPE,
} from '../hitpay/environments.js';
import {
  type HitPayConfig,
  getProfile,
  readConfig,
  setProfileOAuth,
} from '../config.js';
import { environmentFetch } from '../http-fetch.js';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval?: number;
}

/** Token endpoint error carrying the OAuth `error` code (e.g. `authorization_pending`). */
export class OAuthTokenError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

const REFRESH_BUFFER_SECONDS = 300;
const DEVICE_CODE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';

export function isOAuthExpired(oauth: OAuthCredentials): boolean {
  return oauth.expires_at <= Math.floor(Date.now() / 1000) + REFRESH_BUFFER_SECONDS;
}

async function exchangeToken(env: Environment, body: URLSearchParams): Promise<OAuthCredentials> {
  const tokenUrl = getOAuthTokenUrl(env);
  const res = await environmentFetch(env, tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    let code: string | undefined;
    try {
      code = (JSON.parse(text) as { error?: string }).error;
    } catch {
      // Non-JSON error body
    }
    throw new OAuthTokenError(`OAuth token exchange failed (${res.status}): ${text}`, code);
  }

  const data = (await res.json()) as TokenResponse;
  const expiresIn = data.expires_in ?? 31_536_000;

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? body.get('refresh_token') ?? '',
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    token_type: 'Bearer',
  };
}

export async function refreshOAuthToken(
  env: Environment,
  oauth: OAuthCredentials,
): Promise<OAuthCredentials> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: OAUTH_CLIENT_ID,
    refresh_token: oauth.refresh_token,
  });

  return exchangeToken(env, body);
}

export async function ensureValidOAuthToken(
  env: Environment,
  config: HitPayConfig = readConfig(),
): Promise<{ accessToken: string; config: HitPayConfig }> {
  const profile = getProfile(config, env);
  const oauth = profile.oauth;

  if (!oauth?.access_token) {
    throw new Error(
      `Not authenticated for ${env}. Run \`hitpay login\` or \`hitpay config set api_key\`.`,
    );
  }

  if (!isOAuthExpired(oauth)) {
    return { accessToken: oauth.access_token, config };
  }

  const refreshed = await refreshOAuthToken(env, oauth);
  setProfileOAuth(env, refreshed);
  const updated = readConfig();
  return { accessToken: refreshed.access_token, config: updated };
}

/** Starts the device authorization flow (RFC 8628) and returns the code to show the user. */
export async function requestDeviceCode(env: Environment): Promise<DeviceCodeResponse> {
  const res = await environmentFetch(env, getOAuthDeviceCodeUrl(env), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({ client_id: OAUTH_CLIENT_ID, scope: OAUTH_LOGIN_SCOPE }),
  });

  if (!res.ok) {
    throw new Error(`Device authorization request failed (${res.status}): ${await res.text()}`);
  }

  return (await res.json()) as DeviceCodeResponse;
}

/** Polls the token endpoint until the user approves or denies the code in the dashboard. */
export async function pollDeviceToken(
  env: Environment,
  device: DeviceCodeResponse,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<OAuthCredentials> {
  const body = new URLSearchParams({
    grant_type: DEVICE_CODE_GRANT,
    client_id: OAUTH_CLIENT_ID,
    device_code: device.device_code,
  });
  const deadline = Date.now() + device.expires_in * 1000;
  let interval = device.interval ?? 5;

  while (Date.now() < deadline) {
    await sleep(interval * 1000);

    try {
      return await exchangeToken(env, body);
    } catch (err) {
      const code = err instanceof OAuthTokenError ? err.code : undefined;
      if (code === 'authorization_pending') continue;
      if (code === 'slow_down') {
        interval += 5;
        continue;
      }
      if (code === 'access_denied') throw new Error('Login was denied in the browser.');
      if (code === 'expired_token') break;
      throw err;
    }
  }

  throw new Error('The login code expired. Run `hitpay login` again.');
}
