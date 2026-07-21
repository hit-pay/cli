import { createServer, type Server, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import {
  type Environment,
  ENVIRONMENT_NAMES,
  getDashboardBaseUrl,
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
const OAUTH_SUCCESS_REDIRECT_SECONDS = 3;

function escapeHtmlAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
}

function oauthSuccessPageHtml(dashboardUrl: string): string {
  const safeDashboardUrl = escapeHtmlAttribute(dashboardUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="${OAUTH_SUCCESS_REDIRECT_SECONDS};url=${safeDashboardUrl}">
  <title>HitPay CLI — Signed in</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background:
        radial-gradient(circle at top, rgba(37, 99, 235, 0.12), transparent 55%),
        linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
    }
    .card {
      width: min(420px, 100%);
      padding: 40px 32px 32px;
      text-align: center;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid rgba(37, 99, 235, 0.12);
      border-radius: 20px;
      box-shadow:
        0 24px 48px rgba(15, 23, 42, 0.08),
        0 1px 0 rgba(255, 255, 255, 0.8) inset;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 24px;
      padding: 6px 12px;
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.08);
      color: #1d4ed8;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .icon {
      width: 72px;
      height: 72px;
      margin: 0 auto 20px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      box-shadow: 0 12px 24px rgba(37, 99, 235, 0.28);
      animation: pop 0.45s ease-out;
    }
    .icon svg {
      width: 34px;
      height: 34px;
      stroke: #fff;
      stroke-width: 2.5;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .check {
      stroke-dasharray: 48;
      stroke-dashoffset: 48;
      animation: draw 0.5s ease-out 0.15s forwards;
    }
    h1 {
      font-size: 1.5rem;
      line-height: 1.3;
      font-weight: 700;
      margin-bottom: 10px;
    }
    p {
      color: #475569;
      font-size: 0.975rem;
      line-height: 1.6;
    }
    .hint {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid rgba(15, 23, 42, 0.08);
      font-size: 0.875rem;
      color: #64748b;
    }
    .countdown {
      display: inline-block;
      margin-top: 8px;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      color: #1d4ed8;
    }
    .link {
      display: inline-block;
      margin-top: 16px;
      color: #2563eb;
      font-weight: 600;
      text-decoration: none;
    }
    .link:hover {
      text-decoration: underline;
    }
    @keyframes pop {
      from { transform: scale(0.85); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    @keyframes draw {
      to { stroke-dashoffset: 0; }
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="badge">HitPay CLI</div>
    <div class="icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path class="check" d="M6 12.5l4 4L18 8.5"></path>
      </svg>
    </div>
    <h1>You're signed in</h1>
    <p>Authentication completed successfully. Return to your terminal to continue using the CLI.</p>
    <p class="hint">
      Redirecting to your HitPay dashboard in
      <span class="countdown" id="countdown">${OAUTH_SUCCESS_REDIRECT_SECONDS}</span>s.
    </p>
    <a class="link" href="${safeDashboardUrl}">Continue to dashboard now</a>
  </main>
  <script>
    (function () {
      var seconds = ${OAUTH_SUCCESS_REDIRECT_SECONDS};
      var dashboardUrl = ${JSON.stringify(dashboardUrl)};
      var countdown = document.getElementById('countdown');
      var timer = setInterval(function () {
        seconds -= 1;
        if (countdown) countdown.textContent = String(seconds);
        if (seconds <= 0) {
          clearInterval(timer);
          window.location.href = dashboardUrl;
        }
      }, 1000);
    })();
  </script>
</body>
</html>`;
}

function endResponse(res: ServerResponse, status: number, body: string, type = 'text/plain'): void {
  res.writeHead(status, {
    'Content-Type': type,
    Connection: 'close',
  });
  res.end(body);
  res.socket?.destroy();
}

function closeOAuthServer(server: Server | undefined): Promise<void> {
  if (!server) return Promise.resolve();

  return new Promise((resolve) => {
    server.closeAllConnections();
    server.close(() => resolve());
  });
}

export interface OAuthLoginOptions {
  environment: Environment;
  port?: number;
  onWaitingForAuth?: () => void;
  onCompleting?: () => void;
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

function waitForCallback(
  port: number,
  expectedState: string,
  dashboardUrl: string,
): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    let server: Server | undefined;
    let settled = false;

    const finish = (handler: () => void) => {
      if (settled) return;
      settled = true;
      process.off('SIGINT', onSigint);
      void closeOAuthServer(server).finally(handler);
      server = undefined;
    };

    const onSigint = () => {
      finish(() => {
        reject(new Error('Login cancelled.'));
      });
    };

    process.on('SIGINT', onSigint);

    server = createServer((req, res) => {
      try {
        if (!req.url) {
          endResponse(res, 400, 'Bad request');
          return;
        }

        const incoming = new URL(req.url, `http://127.0.0.1:${port}`);

        if (incoming.pathname !== OAUTH_CALLBACK_PATH) {
          endResponse(res, 404, 'Not found');
          return;
        }

        const error = incoming.searchParams.get('error');
        if (error) {
          endResponse(res, 400, `Authorization denied: ${error}`);
          finish(() => {
            reject(new Error(`OAuth authorization denied: ${error}`));
          });
          return;
        }

        const state = incoming.searchParams.get('state');
        const code = incoming.searchParams.get('code');

        if (!state || state !== expectedState) {
          endResponse(res, 400, 'Invalid OAuth state');
          finish(() => {
            reject(new Error('OAuth state mismatch — possible CSRF attempt.'));
          });
          return;
        }

        if (!code) {
          endResponse(res, 400, 'Missing authorization code');
          finish(() => {
            reject(new Error('OAuth callback missing authorization code.'));
          });
          return;
        }

        endResponse(res, 200, oauthSuccessPageHtml(dashboardUrl), 'text/html; charset=utf-8');
        finish(() => {
          resolve({ code });
        });
      } catch (err) {
        finish(() => {
          reject(err);
        });
      }
    });

    server.on('error', (err) => {
      finish(() => {
        reject(err);
      });
    });
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
  const dashboardUrl = getDashboardBaseUrl(env);
  const callbackPromise = waitForCallback(port, state, dashboardUrl);

  await openBrowser(authorizeUrl);
  options.onWaitingForAuth?.();
  const { code } = await callbackPromise;
  options.onCompleting?.();

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
