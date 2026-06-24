// Vendored from hitpay-mcp (currently unpublished) — only the surface the CLI uses.
// ponytail: generic REST client + the HitPayApiError contract pinned by tests/lib/errors.test.ts.

export type Environment = 'sandbox' | 'production';

const BASE_URLS: Record<Environment, string> = {
  sandbox: 'https://api.sandbox.hit-pay.com',
  production: 'https://api.hit-pay.com',
};

interface HitPayErrorBody {
  message?: string;
  errors?: Record<string, string[]>;
}

function suggest(statusCode: number, path: string): string {
  switch (statusCode) {
    case 400:
      return `Bad request to ${path} — check the parameters.`;
    case 401:
      return 'Authentication failed — check your API key and environment (run `hitpay login`).';
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

  constructor(statusCode: number, body: HitPayErrorBody, path: string) {
    super(body.message ?? `Request to ${path} failed (${statusCode})`);
    this.name = 'HitPayApiError';
    this.statusCode = statusCode;
    this.errorCode = `HITPAY_${statusCode}`;
    this.path = path;
    this.details = body.errors;
    this.suggestion = suggest(statusCode, path);
  }
}

export class HitPayClient {
  private readonly apiKey: string;
  private readonly baseURL: string;
  readonly environment: Environment;

  constructor(apiKey: string, environment: Environment = 'sandbox') {
    this.apiKey = apiKey;
    this.environment = environment;
    this.baseURL = BASE_URLS[environment] ?? BASE_URLS.sandbox;
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

  /** Lightweight auth/ reachability check. */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.get('/v1/account-status');
      return true;
    } catch {
      return false;
    }
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
    const res = await fetch(url, {
      method,
      headers: {
        'X-BUSINESS-API-KEY': this.apiKey,
        Accept: 'application/json',
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      },
      body: hasBody ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      let errorBody: HitPayErrorBody = {};
      try {
        errorBody = (await res.json()) as HitPayErrorBody;
      } catch {
        // non-JSON error body; proceed with what we have
      }
      throw new HitPayApiError(res.status, errorBody, path);
    }

    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
}
