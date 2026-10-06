export type Environment = 'local' | 'staging' | 'sandbox' | 'production';

export const ENVIRONMENT_NAMES: Environment[] = ['local', 'staging', 'sandbox', 'production'];

/** Environments shown in public CLI help (excludes internal local/staging). */
export const PUBLIC_ENVIRONMENT_NAMES: Environment[] = ['sandbox', 'production'];

export interface EnvironmentProfile {
  api_key?: string;
  salt?: string;
  oauth?: OAuthCredentials;
}

export interface OAuthCredentials {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: 'Bearer';
  scopes?: string[];
  business_id?: string;
}

interface EnvironmentDefinition {
  apiBaseUrl: string;
  dashboardBaseUrl: string;
  oauthDeviceCodePath: string;
  oauthTokenPath: string;
}

/**
 * First-party HitPay CLI OAuth client, created with this fixed ID by a migration
 * in every environment (`create_hitpay_cli_oauth_client`).
 */
export const OAUTH_CLIENT_ID = '01a10f6f-abb2-71c0-8849-c048c938142d';

/** Scopes requested during CLI OAuth login (must match scopes enabled on the OAuth app). */
export const OAUTH_LOGIN_SCOPE = 'business:read payments commerce customer';

export const ENVIRONMENTS: Record<Environment, EnvironmentDefinition> = {
  local: {
    apiBaseUrl: 'https://api.src.test',
    dashboardBaseUrl: 'https://dashboard.src.test',
    oauthDeviceCodePath: '/v1/open/oauth/device/code',
    oauthTokenPath: '/v1/open/oauth/token',
  },
  staging: {
    apiBaseUrl: 'https://api.staging.hit-pay.com',
    dashboardBaseUrl: 'https://dashboard.staging.hit-pay.com',
    oauthDeviceCodePath: '/v1/open/oauth/device/code',
    oauthTokenPath: '/v1/open/oauth/token',
  },
  sandbox: {
    apiBaseUrl: 'https://api.sandbox.hit-pay.com',
    dashboardBaseUrl: 'https://dashboard.sandbox.hit-pay.com',
    oauthDeviceCodePath: '/v1/open/oauth/device/code',
    oauthTokenPath: '/v1/open/oauth/token',
  },
  production: {
    apiBaseUrl: 'https://api.hit-pay.com',
    dashboardBaseUrl: 'https://dashboard.hit-pay.com',
    oauthDeviceCodePath: '/v1/open/oauth/device/code',
    oauthTokenPath: '/v1/open/oauth/token',
  },
};

export function isEnvironment(value: string): value is Environment {
  return (ENVIRONMENT_NAMES as string[]).includes(value);
}

export function getApiBaseUrl(env: Environment): string {
  return ENVIRONMENTS[env].apiBaseUrl;
}

export function getDashboardBaseUrl(env: Environment): string {
  return ENVIRONMENTS[env].dashboardBaseUrl;
}

export function getOAuthDeviceCodeUrl(env: Environment): string {
  return `${getApiBaseUrl(env)}${ENVIRONMENTS[env].oauthDeviceCodePath}`;
}

export function getOAuthTokenUrl(env: Environment): string {
  return `${getApiBaseUrl(env)}${ENVIRONMENTS[env].oauthTokenPath}`;
}
