import { Command } from 'commander';
import { confirm } from '@inquirer/prompts';
import type { ChargeResponse, RefundResponse } from '../lib/hitpay/types.js';
import { formatCurrency } from '../lib/hitpay/formatters.js';
import { createClientFromCmd } from '../lib/client.js';
import { createSpinner } from '../lib/spinner.js';
import * as output from '../lib/output.js';
import { handleError } from '../lib/errors.js';

export function registerRefund(program: Command): void {
  program
    .command('refund')
    .description('Refund a charge (requires confirmation)')
    .requiredOption('--payment-id <id>', 'Charge/payment ID to refund')
    .option('--amount <amount>', 'Amount to refund (omit for full refund)')
    .option('--email <email>', 'Send refund notification to this email')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (opts, cmd) => {
      try {
        const client = await createClientFromCmd(cmd);

        // Fetch charge details first to show what we're refunding
        const spinner = createSpinner('Fetching charge details...');
        spinner.start();

        let chargeAmount: number | undefined;
        let chargeCurrency = 'SGD';

        try {
          const charge = await client.get<ChargeResponse>(`/v1/charges/${opts.paymentId}`);
          chargeAmount = charge.amount;
          chargeCurrency = charge.currency.toUpperCase();
          spinner.stop();

          output.info(`Charge: ${formatCurrency(charge.amount, charge.currency)} — ${charge.status}`);
        } catch {
          spinner.stop();
          output.warn('Could not fetch charge details. Proceeding with refund...');
        }

        const refundAmount = opts.amount ? parseFloat(opts.amount) : chargeAmount;
        if (!refundAmount) {
          output.error('Cannot determine refund amount. Please specify --amount.');
          process.exit(1);
        }

        const isPartial = chargeAmount && refundAmount < chargeAmount;
        const label = isPartial ? 'Partial refund' : 'Full refund';

        // Confirmation prompt (skip with --yes)
        if (!opts.yes) {
          const confirmed = await confirm({
            message: `${label}: ${formatCurrency(refundAmount, chargeCurrency)} from charge ${opts.paymentId}. Proceed?`,
            default: false,
          });

          if (!confirmed) {
            output.info('Refund canceled.');
            return;
          }
        }

        const refundSpinner = createSpinner('Processing refund...');
        refundSpinner.start();

        const body: Record<string, unknown> = {
          payment_id: opts.paymentId,
          amount: refundAmount,
        };
        if (opts.email) {
          body.send_email = true;
          body.email = opts.email;
        }

        const refund = await client.post<RefundResponse>('/v1/refund', body);

        refundSpinner.stop();

        if (output.isJsonMode()) {
          output.printData(refund);
          return;
        }

        output.success(`Refund processed: ${formatCurrency(refund.amount_refunded, refund.currency)}`);
        output.printData({
          refund_id: refund.id,
          payment_id: refund.payment_id,
          amount_refunded: formatCurrency(refund.amount_refunded, refund.currency),
          total_amount: formatCurrency(refund.total_amount, refund.currency),
          payment_method: refund.payment_method,
          status: refund.status || 'processing',
          created: refund.created_at,
        });
      } catch (err) {
        handleError(err);
      }
    });
}
