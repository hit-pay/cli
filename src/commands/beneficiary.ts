import { Command } from 'commander';
import type { BeneficiaryResponse, CursorPaginatedResponse } from '../lib/hitpay/types.js';
import { createClient } from '../lib/client.js';
import { createSpinner } from '../lib/spinner.js';
import * as output from '../lib/output.js';
import { handleError } from '../lib/errors.js';

export function registerBeneficiary(program: Command): void {
  const ben = program
    .command('beneficiary')
    .description('Manage payout beneficiaries');

  ben
    .command('create')
    .description('Create a beneficiary for payouts')
    .requiredOption('--country <code>', 'Country code (SG, MY, etc.)')
    .requiredOption('--currency <currency>', 'Currency code')
    .requiredOption('--holder-name <name>', 'Account holder name')
    .requiredOption('--account <number>', 'Account number')
    .requiredOption('--bank-swift <code>', 'Bank SWIFT/BIC code')
    .option('--holder-type <type>', 'individual or company', 'individual')
    .option('--transfer-method <method>', 'Transfer method', 'local')
    .option('--nickname <name>', 'Nickname for this beneficiary')
    .option('--email <email>', 'Beneficiary email')
    .action(async (opts, cmd) => {
      try {
        const globalOpts = cmd.parent?.parent?.opts() || {};
        const client = createClient({ environment: globalOpts.env });

        const spinner = createSpinner('Creating beneficiary...');
        spinner.start();

        const body: Record<string, unknown> = {
          country: opts.country.toUpperCase(),
          currency: opts.currency.toUpperCase(),
          holder_name: opts.holderName,
          account_number: opts.account,
          bank_swift_code: opts.bankSwift,
          holder_type: opts.holderType,
          transfer_method: opts.transferMethod,
        };
        if (opts.nickname) body.nickname = opts.nickname;
        if (opts.email) body.email = opts.email;

        const b = await client.post<BeneficiaryResponse>('/v1/beneficiaries', body);

        spinner.stop();

        if (output.isJsonMode()) {
          output.printData(b);
          return;
        }

        output.success(`Beneficiary created: ${b.id}`);
        output.printData({
          id: b.id,
          holder_name: b.holder_name,
          bank: b.bank_swift_code,
          account: '****' + b.account_number.slice(-4),
          country: b.country,
          status: b.status,
        });
      } catch (err) {
        handleError(err);
      }
    });

  ben
    .command('list')
    .description('List beneficiaries')
    .option('--limit <n>', 'Number of results', '25')
    .action(async (opts, cmd) => {
      try {
        const globalOpts = cmd.parent?.parent?.opts() || {};
        const client = createClient({ environment: globalOpts.env });

        const spinner = createSpinner('Fetching beneficiaries...');
        spinner.start();

        const res = await client.get<CursorPaginatedResponse<BeneficiaryResponse>>(
          '/v1/beneficiaries',
          { per_page: parseInt(opts.limit) },
        );

        spinner.stop();

        if (output.isJsonMode()) {
          output.printData(res);
          return;
        }

        const rows = res.data.map((b) => ({
          id: b.id.slice(0, 12) + '...',
          holder_name: b.holder_name,
          bank: b.bank_swift_code,
          account: '****' + b.account_number.slice(-4),
          country: b.country,
          currency: b.currency.toUpperCase(),
          status: b.status,
        }));

        output.printTable(rows);
      } catch (err) {
        handleError(err);
      }
    });

  ben
    .command('delete <id>')
    .description('Delete a beneficiary')
    .action(async (id: string, _, cmd) => {
      try {
        const globalOpts = cmd.parent?.parent?.opts() || {};
        const client = createClient({ environment: globalOpts.env });

        const spinner = createSpinner('Deleting beneficiary...');
        spinner.start();

        await client.delete(`/v1/beneficiaries/${id}`);

        spinner.succeed(`Beneficiary ${id} deleted`);
      } catch (err) {
        handleError(err);
      }
    });
}
