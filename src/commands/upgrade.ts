import { Command } from 'commander';
import {
  CLI_PACKAGE_NAME,
  fetchLatestVersion,
  getCurrentVersion,
  isNewerVersion,
  runNpmGlobalInstall,
} from '../lib/cli-version.js';
import { getGlobalOpts } from '../lib/global-options.js';
import { createSpinner } from '../lib/spinner.js';
import * as output from '../lib/output.js';
import { handleError } from '../lib/errors.js';

export function registerUpgrade(program: Command): void {
  program
    .command('upgrade')
    .description('Upgrade HitPay CLI to the latest npm version')
    .option('--check', 'Check for updates without installing')
    .action(async (opts, cmd) => {
      try {
        const checkOnly = Boolean(opts.check);
        const jsonMode = getGlobalOpts(cmd).json;
        const current = getCurrentVersion();

        const spinner = createSpinner('Checking for updates...');
        if (!jsonMode) {
          spinner.start();
        }

        const latest = await fetchLatestVersion();
        const updateAvailable = isNewerVersion(latest, current);

        if (!jsonMode) {
          spinner.stop();
        }

        if (checkOnly) {
          const payload = {
            current,
            latest,
            update_available: updateAvailable,
          };

          if (jsonMode) {
            output.printData(payload);
            return;
          }

          if (updateAvailable) {
            output.info(`Update available: ${current} → ${latest}`);
            output.info('Run `hitpay upgrade` to install the latest version.');
          } else {
            output.success(`HitPay CLI is up to date (${current})`);
          }
          return;
        }

        if (!updateAvailable) {
          if (jsonMode) {
            output.printData({
              current,
              latest,
              updated: false,
            });
            return;
          }

          output.success(`HitPay CLI is already up to date (${current})`);
          return;
        }

        if (jsonMode) {
          output.printData({
            current,
            latest,
            updated: false,
            message: 'Re-run without --json to perform the upgrade.',
          });
          return;
        }

        output.info(`Upgrading ${CLI_PACKAGE_NAME} ${current} → ${latest}...`);
        await runNpmGlobalInstall(latest);
        output.success(`Upgraded to ${CLI_PACKAGE_NAME}@${latest}`);
      } catch (err) {
        handleError(err);
      }
    });
}
