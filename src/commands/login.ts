import { Command } from 'commander';
import {
  clearProfileAuth,
  getActiveEnvironment,
  getAuthMethod,
  getConfigPath,
  getProfile,
  readConfig,
  resolveEnvironment,
} from '../lib/config.js';
import { createClientFromCmd, getResolvedApiUrl } from '../lib/client.js';
import { loginWithOAuth } from '../lib/auth/oauth.js';
import { getGlobalOpts } from '../lib/global-options.js';
import { createSpinner } from '../lib/spinner.js';
import * as output from '../lib/output.js';
import { handleError } from '../lib/errors.js';

const AUTH_HINT = 'Run `hitpay login` or `hitpay config set api_key <key>`.';

export function registerLogin(program: Command): void {
  program
    .command('login')
    .description('Sign in via browser (OAuth)')
    .option('--oauth-port <port>', 'Local OAuth callback port', '8085')
    .action(async (opts, cmd) => {
      try {
        const globalOpts = getGlobalOpts(cmd);
        if (globalOpts.env) {
          throw new Error(
            'Switch environment first with `hitpay env use <env>`, then run `hitpay login`.',
          );
        }

        const config = readConfig();
        const env = getActiveEnvironment(config);

        const spinner = createSpinner('Opening browser for sign-in...');
        spinner.start();

        await loginWithOAuth({
          environment: env,
          port: Number(opts.oauthPort),
        });

        spinner.succeed(`Authenticated with HitPay (${env})`);
      } catch (err) {
        handleError(err);
      }
    });
}

export function registerLogout(program: Command): void {
  program
    .command('logout')
    .description('Remove stored credentials for the active environment')
    .option('--all', 'Also remove API key and webhook salt')
    .action(async (opts, cmd) => {
      try {
        const config = readConfig();
        const globalOpts = getGlobalOpts(cmd);
        const env = resolveEnvironment(config, globalOpts.env);
        clearProfileAuth(env, Boolean(opts.all));

        if (opts.all) {
          output.success(`Logged out of ${env} (OAuth, API key, and salt removed).`);
        } else {
          output.success(`Logged out of ${env} (OAuth tokens removed).`);
        }
      } catch (err) {
        handleError(err);
      }
    });
}

export function registerWhoami(program: Command): void {
  program
    .command('whoami')
    .description('Show current account info and environment')
    .action(async (_, cmd) => {
      try {
        const globalOpts = getGlobalOpts(cmd);
        const config = readConfig();
        const env = resolveEnvironment(config, globalOpts.env);
        const profile = getProfile(config, env);
        const authMethod = getAuthMethod(profile);

        if (!authMethod && !globalOpts.apiKey) {
          output.error(`Not authenticated for ${env}. ${AUTH_HINT}`);
          process.exit(1);
        }

        const spinner = createSpinner('Fetching account info...');
        spinner.start();

        const client = await createClientFromCmd(cmd);

        const infoPath = client.authMethod === 'oauth' ? '/v1/info' : '/v1/account-status';
        const info = await client
          .get<{
            id?: string;
            name?: string;
            display_name?: string;
            business_name?: string;
            email?: string;
            country?: string;
          }>(infoPath)
          .catch(() => null);

        const verified = info ? true : await client.verifyConnection();

        spinner.stop();

        if (!verified) {
          output.error('Unable to connect. Re-authenticate for this environment.');
          process.exit(1);
        }

        output.printData({
          environment: env,
          active_environment: getActiveEnvironment(config),
          auth_method: client.authMethod,
          api_url: getResolvedApiUrl(globalOpts.env),
          ...(info || {}),
          config_path: getConfigPath(),
        });
      } catch (err) {
        handleError(err);
      }
    });
}
