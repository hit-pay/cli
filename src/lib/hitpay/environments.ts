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
  oauthAuthorizePath: string;
  oauthTokenPath: string;
}

/**
 * First-party HitPay CLI OAuth app client IDs — compiled into the build (one app per environment).
 * Replace with the IDs registered in each HitPay OAuth app before publish.
 */
/** Scopes requested during CLI OAuth login (must match scopes enabled on the OAuth app). */
export const OAUTH_LOGIN_SCOPE =
  'business:read payments:read payments:create payments:cancel payments:refund';

export const OAUTH_CLIENT_IDS: Record<Environment, string> = {
  local: '019f5cb1-5d7f-710c-ac45-dcc448f95ae5',
  staging: 'hitpay-cli-staging',
  sandbox: 'hitpay-cli-sandbox',
  production: 'hitpay-cli-production',
};

export const ENVIRONMENTS: Record<Environment, EnvironmentDefinition> = {
  local: {
    apiBaseUrl: 'https://api.src.test',
    dashboardBaseUrl: 'https://dashboard.src.test',
    oauthAuthorizePath: '/oauth/authorize',
    oauthTokenPath: '/v1/open/oauth/token',
  },
  staging: {
    apiBaseUrl: 'https://api.staging.hit-pay.com',
    dashboardBaseUrl: 'https://dashboard.staging.hit-pay.com',
    oauthAuthorizePath: '/oauth/authorize',
    oauthTokenPath: '/v1/open/oauth/token',
  },
  sandbox: {
    apiBaseUrl: 'https://api.sandbox.hit-pay.com',
    dashboardBaseUrl: 'https://dashboard.sandbox.hit-pay.com',
    oauthAuthorizePath: '/oauth/authorize',
    oauthTokenPath: '/v1/open/oauth/token',
  },
  production: {
    apiBaseUrl: 'https://api.hit-pay.com',
    dashboardBaseUrl: 'https://dashboard.hit-pay.com',
    oauthAuthorizePath: '/oauth/authorize',
    oauthTokenPath: '/v1/open/oauth/token',
  },
};

export function isEnvironment(value: string): value is Environment {
  return (ENVIRONMENT_NAMES as string[]).includes(value);
}

export function getApiBaseUrl(env: Environment): string {
  return ENVIRONMENTS[env].apiBaseUrl;
}

export function getOAuthAuthorizeUrl(env: Environment): string {
  const { dashboardBaseUrl, oauthAuthorizePath } = ENVIRONMENTS[env];
  return `${dashboardBaseUrl}${oauthAuthorizePath}`;
}

export function getOAuthTokenUrl(env: Environment): string {
  return `${getApiBaseUrl(env)}${ENVIRONMENTS[env].oauthTokenPath}`;
}

export function getOAuthClientId(env: Environment): string {
  return OAUTH_CLIENT_IDS[env];
}

export function hasOAuthClientId(env: Environment): boolean {
  return OAUTH_CLIENT_IDS[env].length > 0;
}
