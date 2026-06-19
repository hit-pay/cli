import { Command } from 'commander';
import type { BalanceResponse } from '../lib/hitpay/types.js';
import { formatCurrency } from '../lib/hitpay/formatters.js';
import { createClient } from '../lib/client.js';
import { createSpinner } from '../lib/spinner.js';
import * as output from '../lib/output.js';
import { handleError } from '../lib/errors.js';

export function registerBalance(program: Command): void {
  program
    .command('balance')
    .description('Show account balances by currency')
    .action(async (_, cmd) => {
      try {
        const globalOpts = cmd.parent?.opts() || {};
        const client = createClient({ environment: globalOpts.env });

        const spinner = createSpinner('Fetching balances...');
        spinner.start();

        const balances = await client.get<BalanceResponse[]>('/v1/balances');

        spinner.stop();

        if (output.isJsonMode()) {
          output.printData(balances);
          return;
        }

        if (!balances || balances.length === 0) {
          output.info('No balances found.');
          return;
        }

        const rows = balances.map((b) => ({
          currency: b.currency.toUpperCase(),
          available: formatCurrency(b.wallets.available, b.currency),
          pending: formatCurrency(b.wallets.pending, b.currency),
          deposit: formatCurrency(b.wallets.deposit, b.currency),
        }));

        output.printTable(rows);
      } catch (err) {
        handleError(err);
      }
    });
}
