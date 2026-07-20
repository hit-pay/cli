import type { Command } from 'commander';
import { HitPayClient } from './hitpay/client.js';
import {
  getAuthMethod,
  getProfile,
  readConfig,
  resolveEnvironment,
} from './config.js';
import { ensureValidOAuthToken } from './auth/token-manager.js';
import { getGlobalOpts } from './global-options.js';
import { getApiBaseUrl } from './hitpay/environments.js';

const AUTH_HINT = 'Run `hitpay login` or `hitpay config set api_key <key>`.';

export async function createClient(opts?: {
  apiKey?: string;
  environment?: string;
}): Promise<HitPayClient> {
  const config = readConfig();
  const env = resolveEnvironment(config, opts?.environment);
  const profile = getProfile(config, env);

  const apiKey = opts?.apiKey ?? profile.api_key;
  if (apiKey) {
    return new HitPayClient({
      environment: env,
      auth: { method: 'api_key', apiKey },
    });
  }

  if (profile.oauth?.access_token) {
    const { accessToken } = await ensureValidOAuthToken(env, config);
    return new HitPayClient({
      environment: env,
      auth: { method: 'oauth', accessToken },
    });
  }

  const authHint = getAuthMethod(profile);
  throw new Error(
    authHint ? `Unable to authenticate for ${env}.` : `Not authenticated for ${env}. ${AUTH_HINT}`,
  );
}

export async function createClientFromCmd(cmd: Command): Promise<HitPayClient> {
  const opts = getGlobalOpts(cmd);
  return createClient({
    environment: opts.env,
    apiKey: opts.apiKey,
  });
}

export function getResolvedApiUrl(environment?: string): string {
  const config = readConfig();
  const env = resolveEnvironment(config, environment);
  return getApiBaseUrl(env);
}
