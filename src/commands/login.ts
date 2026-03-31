import { Command } from 'commander';
import { input, password } from '@inquirer/prompts';
import { HitPayClient } from 'hitpay-mcp/client';
import type { Environment } from 'hitpay-mcp/client';
import { readConfig, writeConfig } from '../lib/config.js';
import { createClient } from '../lib/client.js';
import { createSpinner } from '../lib/spinner.js';
import * as output from '../lib/output.js';
import { handleError } from '../lib/errors.js';

export function registerLogin(program: Command): void {
  program
    .command('login')
    .description('Authenticate with your HitPay API key')
    .option('--api-key <key>', 'HitPay API key (or enter interactively)')
    .option('--salt <salt>', 'Webhook signature salt')
    .option('--environment <env>', 'sandbox or production', 'sandbox')
    .action(async (opts) => {
      try {
        let apiKey = opts.apiKey;
        let salt = opts.salt;
        const env = opts.environment as Environment;

        if (!apiKey) {
          apiKey = await password({
            message: 'Enter your HitPay API key:',
            mask: '*',
          });
        }

        if (!salt) {
          salt = await password({
            message: 'Enter your webhook salt (optional, press Enter to skip):',
            mask: '*',
          });
        }

        const spinner = createSpinner('Verifying API key...');
        spinner.start();

        const client = new HitPayClient(apiKey.trim(), env);
        const valid = await client.verifyConnection();

        if (!valid) {
          spinner.fail('Invalid API key or unable to connect');
          process.exit(1);
        }

        const config = readConfig();
        config.api_key = apiKey.trim();
        config.environment = env;
        if (salt) config.salt = salt.trim();
        writeConfig(config);

        spinner.succeed(`Authenticated with HitPay (${env})`);
      } catch (err) {
        handleError(err);
      }
    });
}

export function registerLogout(program: Command): void {
  program
    .command('logout')
    .description('Remove stored HitPay credentials')
    .action(async () => {
      try {
        const config = readConfig();
        delete config.api_key;
        delete config.salt;
        writeConfig(config);
        output.success('Logged out. API key removed.');
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
        const globalOpts = cmd.parent?.opts() || {};
        const client = createClient({ environment: globalOpts.env });

        const spinner = createSpinner('Fetching account info...');
        spinner.start();

        const info = await client.get<{
          id?: string;
          business_name?: string;
          email?: string;
          country?: string;
        }>('/v1/basicinfo').catch(() => null);

        // Fallback: verify connection works
        const verified = info ? true : await client.verifyConnection();

        spinner.stop();

        if (!verified) {
          output.error('Unable to connect. Run `hitpay login` to re-authenticate.');
          process.exit(1);
        }

        const config = readConfig();
        output.printData({
          environment: config.environment || 'sandbox',
          ...(info || {}),
          config_path: '~/.hitpay/config.json',
        });
      } catch (err) {
        handleError(err);
      }
    });
}
