import { type Environment } from './hitpay/environments.js';

function formatFetchError(err: unknown, env: Environment, url: string): Error {
  if (err instanceof TypeError && err.message === 'fetch failed') {
    const cause = err.cause instanceof Error ? err.cause.message : String(err.cause ?? '');
    const tlsHint =
      env === 'local'
        ? ' Local HTTPS (api.src.test) uses a dev certificate — the CLI trusts it for `local` only.'
        : '';
    return new Error(`Could not reach ${url}: ${cause || 'network error'}.${tlsHint}`);
  }

  if (err instanceof Error) {
    return err;
  }

  return new Error(String(err));
}

async function fetchWithOptionalLocalTls(env: Environment, input: string | URL, init?: RequestInit): Promise<Response> {
  if (env !== 'local') {
    return fetch(input, init);
  }

  // Local stacks (Valet/Herd/mkcert) often use a CA browsers trust but Node rejects.
  const previous = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  try {
    return await fetch(input, init);
  } finally {
    if (previous === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = previous;
    }
  }
}

export async function environmentFetch(
  env: Environment,
  input: string | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString();

  try {
    return await fetchWithOptionalLocalTls(env, input, init);
  } catch (err) {
    throw formatFetchError(err, env, url);
  }
}
