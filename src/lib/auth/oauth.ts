import { createServer, type Server } from 'node:http';
import { URL } from 'node:url';
import {
  type Environment,
  ENVIRONMENT_NAMES,
  getOAuthAuthorizeUrl,
  getOAuthClientId,
  hasOAuthClientId,
  isEnvironment,
  OAUTH_LOGIN_SCOPE,
} from '../hitpay/environments.js';
import { setProfileOAuth } from '../config.js';
import { HitPayClient } from '../hitpay/client.js';
import { openBrowser } from './browser.js';
import { exchangeAuthorizationCode } from './token-manager.js';
import { generateOAuthState, generatePkce } from './pkce.js';

const DEFAULT_OAUTH_PORT = 8085;
const OAUTH_CALLBACK_PATH = '/callback';

export interface OAuthLoginOptions {
  environment: Environment;
  port?: number;
}

export interface OAuthLoginResult {
  environment: Environment;
  businessId?: string;
}

function buildRedirectUri(port: number): string {
  return `http://127.0.0.1:${port}${OAUTH_CALLBACK_PATH}`;
}

function buildAuthorizeUrl(
  env: Environment,
  redirectUri: string,
  state: string,
  challenge: string,
  clientId: string,
): string {
  const url = new URL(getOAuthAuthorizeUrl(env));
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', OAUTH_LOGIN_SCOPE);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

function waitForCallback(port: number, expectedState: string): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    let server: Server | undefined;

    const cleanup = () => {
      server?.close();
    };

    server = createServer((req, res) => {
      try {
        if (!req.url) {
          res.writeHead(400);
          res.end('Bad request');
          return;
        }

        const incoming = new URL(req.url, `http://127.0.0.1:${port}`);

        if (incoming.pathname !== OAUTH_CALLBACK_PATH) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        const error = incoming.searchParams.get('error');
        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end(`Authorization denied: ${error}`);
          cleanup();
          reject(new Error(`OAuth authorization denied: ${error}`));
          return;
        }

        const state = incoming.searchParams.get('state');
        const code = incoming.searchParams.get('code');

        if (!state || state !== expectedState) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Invalid OAuth state');
          cleanup();
          reject(new Error('OAuth state mismatch — possible CSRF attempt.'));
          return;
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Missing authorization code');
          cleanup();
          reject(new Error('OAuth callback missing authorization code.'));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          '<html><body><h1>HitPay CLI</h1><p>Authenticated. You can close this window.</p></body></html>',
        );
        cleanup();
        resolve({ code });
      } catch (err) {
        cleanup();
        reject(err);
      }
    });

    server.on('error', reject);
    server.listen(port, '127.0.0.1');
  });
}

export async function loginWithOAuth(options: OAuthLoginOptions): Promise<OAuthLoginResult> {
  const env = options.environment;
  const port = options.port ?? DEFAULT_OAUTH_PORT;
  const redirectUri = buildRedirectUri(port);
  const { verifier, challenge } = generatePkce();
  const state = generateOAuthState();

  const clientId = getOAuthClientId(env);
  if (!hasOAuthClientId(env)) {
    throw new Error(
      `OAuth is not configured for "${env}". Use \`hitpay config set api_key\` instead.`,
    );
  }

  const authorizeUrl = buildAuthorizeUrl(env, redirectUri, state, challenge, clientId);
  const callbackPromise = waitForCallback(port, state);

  await openBrowser(authorizeUrl);
  const { code } = await callbackPromise;

  const tokens = await exchangeAuthorizationCode(env, code, redirectUri, verifier);
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
