import {
  type Environment,
  type OAuthCredentials,
  getOAuthClientId,
  getOAuthTokenUrl,
  hasOAuthClientId,
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

const REFRESH_BUFFER_SECONDS = 300;

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
    throw new Error(`OAuth token exchange failed (${res.status}): ${text}`);
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
  const clientId = getOAuthClientId(env);
  if (!hasOAuthClientId(env)) {
    throw new Error(`OAuth is not configured for environment "${env}".`);
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
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

export async function exchangeAuthorizationCode(
  env: Environment,
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<OAuthCredentials> {
  if (!hasOAuthClientId(env)) {
    throw new Error(
      `OAuth client ID is not configured for "${env}". Register the HitPay CLI OAuth app first.`,
    );
  }

  const clientId = getOAuthClientId(env);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
    code_verifier: codeVerifier,
  });

  return exchangeToken(env, body);
}
