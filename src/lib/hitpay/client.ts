// Vendored from hitpay-mcp (currently unpublished) — only the surface the CLI uses.
// ponytail: generic REST client + the HitPayApiError contract pinned by tests/lib/errors.test.ts.

import {
  type Environment,
  getApiBaseUrl,
} from './environments.js';
import { environmentFetch } from '../http-fetch.js';

export type { Environment, EnvironmentProfile, OAuthCredentials } from './environments.js';

export type AuthMethod = 'api_key' | 'oauth';

export interface HitPayClientOptions {
  environment: Environment;
  auth: { method: 'api_key'; apiKey: string } | { method: 'oauth'; accessToken: string };
}

interface HitPayErrorBody {
  message?: string;
  errors?: Record<string, string[]>;
}

function suggest(statusCode: number, path: string, authMethod: AuthMethod): string {
  switch (statusCode) {
    case 400:
      return `Bad request to ${path} — check the parameters.`;
    case 401:
      return authMethod === 'oauth'
        ? 'Authentication failed — run `hitpay login` to re-authenticate.'
        : 'Authentication failed — check your API key and environment (run `hitpay config set api_key`).';
    case 403:
      return `Not permitted to access ${path}.`;
    case 404:
      return `Resource not found at ${path}. Verify the ID is correct.`;
    case 422:
      return 'Validation failed — see the field errors above.';
    case 429:
      return 'Rate limit reached — wait a moment and retry.';
    case 500:
    case 502:
    case 503:
    case 504:
      return `HitPay is experiencing issues (status ${statusCode}). Retry shortly.`;
    default:
      return `Request to ${path} returned status ${statusCode}.`;
  }
}

export class HitPayApiError extends Error {
  readonly statusCode: number;
  readonly errorCode: string;
  readonly suggestion: string;
  readonly details?: Record<string, string[]>;
  readonly path: string;

  constructor(statusCode: number, body: HitPayErrorBody, path: string, authMethod: AuthMethod = 'api_key') {
    super(body.message ?? `Request to ${path} failed (${statusCode})`);
    this.name = 'HitPayApiError';
    this.statusCode = statusCode;
    this.errorCode = `HITPAY_${statusCode}`;
    this.path = path;
    this.details = body.errors;
    this.suggestion = suggest(statusCode, path, authMethod);
  }
}

export class HitPayClient {
  private readonly baseURL: string;
  private readonly auth: HitPayClientOptions['auth'];
  readonly environment: Environment;
  readonly authMethod: AuthMethod;

  constructor(options: HitPayClientOptions) {
    this.environment = options.environment;
    this.baseURL = getApiBaseUrl(options.environment);
    this.auth = options.auth;
    this.authMethod = options.auth.method;
  }

  /** @deprecated Use HitPayClientOptions constructor. Kept for config verify during set api_key. */
  static withApiKey(apiKey: string, environment: Environment): HitPayClient {
    return new HitPayClient({
      environment,
      auth: { method: 'api_key', apiKey },
    });
  }

  updateOAuthAccessToken(accessToken: string): void {
    if (this.auth.method === 'oauth') {
      this.auth.accessToken = accessToken;
    }
  }

  get<T>(path: string, query?: Record<string, unknown>): Promise<T> {
    return this.request<T>('GET', path, undefined, query);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  delete(path: string): Promise<void> {
    return this.request<void>('DELETE', path);
  }

  /** Lightweight auth / reachability check. */
  async verifyConnection(): Promise<boolean> {
    const path = this.auth.method === 'oauth' ? '/v1/info' : '/v1/account-status';
    try {
      await this.get(path);
      return true;
    } catch {
      return false;
    }
  }

  private authHeaders(hasBody: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    };

    if (this.auth.method === 'api_key') {
      headers['X-BUSINESS-API-KEY'] = this.auth.apiKey;
    } else {
      headers.Authorization = `Bearer ${this.auth.accessToken}`;
    }

    if (hasBody) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, unknown>,
  ): Promise<T> {
    const url = new URL(this.baseURL + path);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const hasBody = body !== undefined;
    const res = await environmentFetch(this.environment, url, {
      method,
      headers: this.authHeaders(hasBody),
      body: hasBody ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      let errorBody: HitPayErrorBody = {};
      try {
        errorBody = (await res.json()) as HitPayErrorBody;
      } catch {
        // non-JSON error body; proceed with what we have
      }
      throw new HitPayApiError(res.status, errorBody, path, this.authMethod);
    }

    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
}
