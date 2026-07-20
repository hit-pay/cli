import { Command } from 'commander';
import { PUBLIC_ENVIRONMENT_NAMES } from '../lib/hitpay/environments.js';
import {
  getActiveEnvironment,
  getConfigPath,
  readConfig,
  setGlobalValue,
} from '../lib/config.js';
import { parseLoginEnvironment } from '../lib/auth/oauth.js';
import * as output from '../lib/output.js';
import { handleError } from '../lib/errors.js';

function showCurrentEnvironment(): void {
  const config = readConfig();
  output.printData({
    active_environment: getActiveEnvironment(config),
    config_path: getConfigPath(),
  });
}

function switchEnvironment(environment: string): void {
  const parsed = parseLoginEnvironment(environment);
  setGlobalValue('environment', parsed);
  output.success(`Active environment set to ${parsed}`);
}

export function registerEnv(program: Command): void {
  const env = program.command('env').description('Show or switch active environment');

  env.action(async () => {
    try {
      showCurrentEnvironment();
    } catch (err) {
      handleError(err);
    }
  });

  env
    .command('use <environment>')
    .description(`Switch active environment (${PUBLIC_ENVIRONMENT_NAMES.join(', ')})`)
    .action(async (environment: string) => {
      try {
        switchEnvironment(environment);
      } catch (err) {
        handleError(err);
      }
    });
}
