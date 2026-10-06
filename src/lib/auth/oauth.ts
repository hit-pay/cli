import {
  type Environment,
  ENVIRONMENT_NAMES,
  isEnvironment,
} from '../hitpay/environments.js';
import { setProfileOAuth } from '../config.js';
import { HitPayClient } from '../hitpay/client.js';
import { openBrowser } from './browser.js';
import { pollDeviceToken, requestDeviceCode } from './token-manager.js';

export interface OAuthLoginOptions {
  environment: Environment;
  /** Called with the code the user confirms in the dashboard, before the browser opens. */
  onUserCode?: (userCode: string, verificationUri: string) => void;
  onWaitingForAuth?: () => void;
}

export interface OAuthLoginResult {
  environment: Environment;
  businessId?: string;
}

/** Formats `WDJBMJHT` as `WDJB-MJHT` so it is easier to compare by eye. */
export function formatUserCode(userCode: string): string {
  return userCode.length === 8 ? `${userCode.slice(0, 4)}-${userCode.slice(4)}` : userCode;
}

/**
 * Signs in with the OAuth device authorization grant: the CLI shows a code,
 * the user approves it for a business in the dashboard, and the CLI polls
 * for the token. No local callback server or redirect URI is involved.
 */
export async function loginWithOAuth(options: OAuthLoginOptions): Promise<OAuthLoginResult> {
  const env = options.environment;
  const device = await requestDeviceCode(env);
  const verificationUrl = device.verification_uri_complete ?? device.verification_uri;

  options.onUserCode?.(formatUserCode(device.user_code), verificationUrl);

  try {
    await openBrowser(verificationUrl);
  } catch {
    // Headless or no browser — the user opens the printed URL themselves
  }

  options.onWaitingForAuth?.();
  const tokens = await pollDeviceToken(env, device);
  setProfileOAuth(env, tokens);

  let businessId: string | undefined;
  try {
    const oauthClient = new HitPayClient({
      environment: env,
      auth: { method: 'oauth', accessToken: tokens.access_token },
    });
    const info = await oauthClient.get<{ id?: string }>('/v1/info');
    businessId = info.id;
    if (businessId) {
      tokens.business_id = businessId;
      setProfileOAuth(env, tokens);
    }
  } catch {
    // Non-fatal — tokens are stored
  }

  return { environment: env, businessId };
}

export function parseLoginEnvironment(value: string): Environment {
  if (!isEnvironment(value)) {
    throw new Error(`Environment must be one of: ${ENVIRONMENT_NAMES.join(', ')}`);
  }
  return value;
}
