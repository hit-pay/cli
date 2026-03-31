import { Command } from 'commander';
import { readConfig, setConfigValue, getConfigValue, getConfigPath } from '../lib/config.js';
import * as output from '../lib/output.js';
import { handleError } from '../lib/errors.js';

export function registerConfig(program: Command): void {
  const config = program
    .command('config')
    .description('Manage CLI configuration');

  config
    .command('set <key> <value>')
    .description('Set a config value (environment, currency, country)')
    .action(async (key: string, value: string) => {
      try {
        setConfigValue(key, value);
        output.success(`Set ${key} = ${value}`);
      } catch (err) {
        handleError(err);
      }
    });

  config
    .command('get <key>')
    .description('Get a config value')
    .action(async (key: string) => {
      try {
        const value = getConfigValue(key);
        if (value !== undefined) {
          console.log(value);
        } else {
          output.warn(`Config key "${key}" is not set`);
        }
      } catch (err) {
        handleError(err);
      }
    });

  config
    .command('list')
    .description('Show all config values')
    .action(async () => {
      try {
        const cfg = readConfig();
        const display: Record<string, string> = {};
        for (const [key, value] of Object.entries(cfg)) {
          if (key === 'api_key' && value) {
            display[key] = value.slice(0, 8) + '...' + value.slice(-4);
          } else if (key === 'salt' && value) {
            display[key] = '****' + value.slice(-4);
          } else if (value) {
            display[key] = value;
          }
        }
        display['config_path'] = getConfigPath();
        output.printData(display);
      } catch (err) {
        handleError(err);
      }
    });
}
