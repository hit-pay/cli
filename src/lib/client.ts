import { HitPayClient } from 'hitpay-mcp/client';
import type { Environment } from 'hitpay-mcp/client';
import { readConfig } from './config.js';

export function createClient(opts?: { apiKey?: string; environment?: string }): HitPayClient {
  const config = readConfig();

  const apiKey = opts?.apiKey || config.api_key;
  if (!apiKey) {
    throw new Error(
      'No API key found. Run `hitpay login` or set HITPAY_API_KEY environment variable.',
    );
  }

  const env = (opts?.environment || config.environment || 'sandbox') as Environment;
  return new HitPayClient(apiKey, env);
}
