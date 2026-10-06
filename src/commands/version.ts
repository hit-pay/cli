import { Command } from 'commander';
import {
  CLI_PACKAGE_NAME,
  fetchLatestVersion,
  getCurrentVersion,
  isNewerVersion,
} from '../lib/cli-version.js';
import { getGlobalOpts } from '../lib/global-options.js';
import * as output from '../lib/output.js';
import { handleError } from '../lib/errors.js';

export function registerVersion(program: Command): void {
  program
    .command('version')
    .description('Show installed CLI version')
    .option('--check', 'Compare with the latest version on npm')
    .action(async (opts, cmd) => {
      try {
        const check = Boolean(opts.check);
        const current = getCurrentVersion();

        if (!check) {
          if (getGlobalOpts(cmd).json) {
            output.printData({ current });
            return;
          }

          console.log(`${CLI_PACKAGE_NAME} v${current}`);
          return;
        }

        const latest = await fetchLatestVersion();
        const updateAvailable = isNewerVersion(latest, current);
        const payload = {
          current,
          latest,
          update_available: updateAvailable,
        };

        if (getGlobalOpts(cmd).json) {
          output.printData(payload);
          return;
        }

        console.log(`${CLI_PACKAGE_NAME} v${current}`);
        if (updateAvailable) {
          output.info(`Latest version: ${latest} (update available — run \`hitpay upgrade\`)`);
        } else {
          output.info(`Latest version: ${latest} (up to date)`);
        }
      } catch (err) {
        handleError(err);
      }
    });
}
