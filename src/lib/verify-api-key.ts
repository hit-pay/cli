import { HitPayClient } from './hitpay/client.js';
import type { Environment } from './hitpay/environments.js';
import { setProfileValue } from './config.js';
import { createSpinner } from './spinner.js';

export async function verifyAndSaveApiKey(env: Environment, apiKey: string): Promise<void> {
  const spinner = createSpinner('Verifying API key...');
  spinner.start();
  const client = HitPayClient.withApiKey(apiKey.trim(), env);
  const valid = await client.verifyConnection();
  if (!valid) {
    spinner.fail('Invalid API key or unable to connect');
    process.exit(1);
  }
  spinner.stop();
  setProfileValue(env, 'api_key', apiKey.trim());
}
