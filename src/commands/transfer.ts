import { Command } from 'commander';
import { confirm } from '@inquirer/prompts';
import type { TransferResponse, TransferEstimateResponse, CursorPaginatedResponse } from '../lib/hitpay/types.js';
import { formatCurrency } from '../lib/hitpay/formatters.js';
import { createClientFromCmd } from '../lib/client.js';
import { createSpinner } from '../lib/spinner.js';
import * as output from '../lib/output.js';
import { handleError } from '../lib/errors.js';

export function registerTransfer(program: Command): void {
  const transfer = program
    .command('transfer')
    .description('Manage payouts / transfers');

  transfer
    .command('estimate')
    .description('Estimate transfer fees before sending')
    .requiredOption('--beneficiary-id <id>', 'Beneficiary ID')
    .requiredOption('--amount <amount>', 'Transfer amount')
    .requiredOption('--currency <currency>', 'Source currency')
    .action(async (opts, cmd) => {
      try {
        const client = await createClientFromCmd(cmd);

        const spinner = createSpinner('Estimating fees...');
        spinner.start();

        const est = await client.post<TransferEstimateResponse>('/v1/transfers/estimate', {
          beneficiary_id: opts.beneficiaryId,
          amount: parseFloat(opts.amount),
          source_currency: opts.currency.toUpperCase(),
        });

        spinner.stop();

        if (output.isJsonMode()) {
          output.printData(est);
          return;
        }

        output.printData({
          source: formatCurrency(est.source_amount, est.source_currency),
          fees: formatCurrency(est.source_amount_fees, est.fee_currency),
          recipient_receives: formatCurrency(est.payment_amount, est.payment_currency),
          exchange_rate: est.exchange_rate || 'N/A',
          fee_payer: est.fee_payer,
        });
      } catch (err) {
        handleError(err);
      }
    });

  transfer
    .command('create')
    .description('Create a transfer/payout (requires confirmation)')
    .requiredOption('--beneficiary-id <id>', 'Beneficiary ID')
    .requiredOption('--amount <amount>', 'Transfer amount')
    .requiredOption('--currency <currency>', 'Source currency')
    .option('--remark <remark>', 'Transfer remark/description')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (opts, cmd) => {
      try {
        const client = await createClientFromCmd(cmd);

        const amount = parseFloat(opts.amount);
        const currency = opts.currency.toUpperCase();

        // Show estimate first
        const spinner = createSpinner('Estimating fees...');
        spinner.start();

        try {
          const est = await client.post<TransferEstimateResponse>('/v1/transfers/estimate', {
            beneficiary_id: opts.beneficiaryId,
            amount,
            source_currency: currency,
          });
          spinner.stop();

          output.info(`Transfer: ${formatCurrency(est.source_amount, est.source_currency)} → ${formatCurrency(est.payment_amount, est.payment_currency)} (fees: ${formatCurrency(est.source_amount_fees, est.fee_currency)})`);
        } catch {
          spinner.stop();
        }

        // Confirmation
        if (!opts.yes) {
          const confirmed = await confirm({
            message: `Transfer ${formatCurrency(amount, currency)} to beneficiary ${opts.beneficiaryId}. Proceed?`,
            default: false,
          });

          if (!confirmed) {
            output.info('Transfer canceled.');
            return;
          }
        }

        const transferSpinner = createSpinner('Creating transfer...');
        transferSpinner.start();

        const body: Record<string, unknown> = {
          beneficiary_id: opts.beneficiaryId,
          amount,
          source_currency: currency,
        };
        if (opts.remark) body.remark = opts.remark;

        const t = await client.post<TransferResponse>('/v1/transfers', body);

        transferSpinner.stop();

        if (output.isJsonMode()) {
          output.printData(t);
          return;
        }

        output.success(`Transfer created: ${t.id}`);
        output.printData({
          id: t.id,
          amount: formatCurrency(t.source_amount, t.source_currency),
          recipient: formatCurrency(t.payment_amount, t.payment_currency),
          status: t.status,
          fees: formatCurrency(t.total_fee, t.fee_currency),
          exchange_rate: t.exchange_rate || 'N/A',
        });
      } catch (err) {
        handleError(err);
      }
    });

  transfer
    .command('list')
    .description('List transfers')
    .option('--status <status>', 'Filter: pending, paid, failed, cancelled')
    .option('--limit <n>', 'Number of results', '25')
    .action(async (opts, cmd) => {
      try {
        const client = await createClientFromCmd(cmd);

        const spinner = createSpinner('Fetching transfers...');
        spinner.start();

        const query: Record<string, string | number> = {
          per_page: parseInt(opts.limit),
        };
        if (opts.status) query.status = opts.status;

        const res = await client.get<CursorPaginatedResponse<TransferResponse>>('/v1/transfers', query);

        spinner.stop();

        if (output.isJsonMode()) {
          output.printData(res);
          return;
        }

        const rows = res.data.map((t) => ({
          id: t.id.slice(0, 12) + '...',
          amount: formatCurrency(t.source_amount, t.source_currency),
          recipient: formatCurrency(t.payment_amount, t.payment_currency),
          status: t.status,
          beneficiary: t.beneficiary.holder_name,
          created: t.created_at.split('T')[0],
        }));

        output.printTable(rows);
      } catch (err) {
        handleError(err);
      }
    });

  transfer
    .command('get <id>')
    .description('Get transfer details')
    .action(async (id: string, _, cmd) => {
      try {
        const client = await createClientFromCmd(cmd);

        const spinner = createSpinner('Fetching transfer...');
        spinner.start();

        const t = await client.get<TransferResponse>(`/v1/transfers/${id}`);

        spinner.stop();

        if (output.isJsonMode()) {
          output.printData(t);
          return;
        }

        output.printData({
          id: t.id,
          amount: formatCurrency(t.source_amount, t.source_currency),
          recipient: formatCurrency(t.payment_amount, t.payment_currency),
          fees: formatCurrency(t.total_fee, t.fee_currency),
          exchange_rate: t.exchange_rate || 'N/A',
          status: t.status,
          beneficiary: `${t.beneficiary.holder_name} (${t.beneficiary.bank_swift_code} ****${t.beneficiary.account_number.slice(-4)})`,
          remark: t.remark || '—',
          created: t.created_at,
        });
      } catch (err) {
        handleError(err);
      }
    });
}
