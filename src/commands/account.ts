import { Command } from 'commander';
import chalk from 'chalk';
import type { AccountStatusResponse } from '../lib/hitpay/types.js';
import { createClientFromCmd } from '../lib/client.js';
import { createSpinner } from '../lib/spinner.js';
import * as output from '../lib/output.js';
import { handleError } from '../lib/errors.js';

export function registerAccount(program: Command): void {
  const account = program
    .command('account')
    .description('Account information');

  account
    .command('status')
    .description('Show KYC verification and enabled payment providers')
    .action(async (_, cmd) => {
      try {
        const client = await createClientFromCmd(cmd);

        const spinner = createSpinner('Fetching account status...');
        spinner.start();

        const status = await client.get<AccountStatusResponse>('/v1/account-status');

        spinner.stop();

        if (output.isJsonMode()) {
          output.printData(status);
          return;
        }

        // Verification status
        if (status.verification) {
          console.log(chalk.bold('\nVerification'));
          const v = status.verification;
          console.log(`  Overall: ${statusBadge(v.overall_status)}`);
          if (v.owner_verification) console.log(`  Owner: ${statusBadge(v.owner_verification)}`);
          if (v.business_verification) console.log(`  Business: ${statusBadge(v.business_verification)}`);
        }

        // Payment providers
        if (status.payment_providers) {
          console.log(chalk.bold('\nPayment Providers'));
          const rows = Object.entries(status.payment_providers).map(([name, p]) => ({
            provider: name,
            status: p.setup_status,
            payments: p.payment_enabled ? chalk.green('enabled') : chalk.dim('disabled'),
            payouts: p.payout_enabled ? chalk.green('enabled') : chalk.dim('disabled'),
          }));
          output.printTable(rows);
        }

        console.log();
      } catch (err) {
        handleError(err);
      }
    });
}

function statusBadge(status?: string): string {
  if (!status) return chalk.dim('unknown');
  switch (status.toLowerCase()) {
    case 'completed':
    case 'verified':
    case 'approved':
      return chalk.green(status);
    case 'pending':
    case 'in_progress':
      return chalk.yellow(status);
    case 'rejected':
    case 'failed':
      return chalk.red(status);
    default:
      return status;
  }
}
