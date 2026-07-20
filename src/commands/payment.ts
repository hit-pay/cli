import { Command } from 'commander';
import type { PaymentRequestResponse, PagePaginatedResponse } from '../lib/hitpay/types.js';
import { formatCurrency, formatPaymentMethod } from '../lib/hitpay/formatters.js';
import { createClientFromCmd } from '../lib/client.js';
import { createSpinner } from '../lib/spinner.js';
import * as output from '../lib/output.js';
import { handleError } from '../lib/errors.js';

export function registerPayment(program: Command): void {
  const payment = program
    .command('payment')
    .description('Manage payment requests');

  payment
    .command('create')
    .description('Create a new payment request')
    .requiredOption('--amount <amount>', 'Payment amount')
    .requiredOption('--currency <currency>', 'Currency code (SGD, MYR, PHP, etc.)')
    .option('--email <email>', 'Customer email')
    .option('--name <name>', 'Customer name')
    .option('--phone <phone>', 'Customer phone')
    .option('--purpose <purpose>', 'Payment purpose / description')
    .option('--reference <ref>', 'Your reference number')
    .option('--method <methods...>', 'Payment methods (e.g. paynow_online card)')
    .option('--redirect-url <url>', 'URL to redirect after payment')
    .option('--webhook <url>', 'Webhook URL for payment notifications')
    .option('--qr', 'Generate QR code for this payment')
    .option('--expiry <minutes>', 'Expire after N minutes')
    .action(async (opts, cmd) => {
      try {
        const client = await createClientFromCmd(cmd);

        const spinner = createSpinner('Creating payment request...');
        spinner.start();

        const body: Record<string, unknown> = {
          amount: parseFloat(opts.amount),
          currency: opts.currency.toUpperCase(),
        };
        if (opts.email) body.email = opts.email;
        if (opts.name) body.name = opts.name;
        if (opts.phone) body.phone = opts.phone;
        if (opts.purpose) body.purpose = opts.purpose;
        if (opts.reference) body.reference_number = opts.reference;
        if (opts.method) body.payment_methods = opts.method;
        if (opts.redirectUrl) body.redirect_url = opts.redirectUrl;
        if (opts.webhook) body.webhook = opts.webhook;
        if (opts.qr) body.generate_qr = true;
        if (opts.expiry) body.expires_after = opts.expiry;

        const pr = await client.post<PaymentRequestResponse>('/v1/payment-requests', body);

        spinner.stop();

        if (output.isJsonMode()) {
          output.printData(pr);
          return;
        }

        output.success(`Payment request created: ${pr.id}`);
        output.printData({
          id: pr.id,
          amount: formatCurrency(pr.amount, pr.currency),
          status: pr.status,
          checkout_url: pr.url || '—',
          methods: pr.payment_methods?.map(formatPaymentMethod).join(', ') || 'all',
        });

        if (pr.qr_code_data?.qr_code) {
          console.log('\nQR Code data available. Use `hitpay qr create` for terminal rendering.');
        }
      } catch (err) {
        handleError(err);
      }
    });

  payment
    .command('get <id>')
    .description('Get payment request details')
    .action(async (id: string, _, cmd) => {
      try {
        const client = await createClientFromCmd(cmd);

        const spinner = createSpinner('Fetching payment...');
        spinner.start();

        const pr = await client.get<PaymentRequestResponse>(`/v1/payment-requests/${id}`);

        spinner.stop();

        if (output.isJsonMode()) {
          output.printData(pr);
          return;
        }

        output.printData({
          id: pr.id,
          amount: formatCurrency(pr.amount, pr.currency),
          status: pr.status,
          purpose: pr.purpose || '—',
          checkout_url: pr.url || '—',
          methods: pr.payment_methods?.map(formatPaymentMethod).join(', ') || 'all',
          created: pr.created_at,
        });
      } catch (err) {
        handleError(err);
      }
    });

  payment
    .command('list')
    .description('List payment requests')
    .option('--limit <n>', 'Number of results', '10')
    .option('--status <status>', 'Filter by status (pending, completed, failed, expired)')
    .option('--page <n>', 'Page number', '1')
    .action(async (opts, cmd) => {
      try {
        const client = await createClientFromCmd(cmd);

        const spinner = createSpinner('Fetching payments...');
        spinner.start();

        const query: Record<string, string | number> = {
          per_page: parseInt(opts.limit),
          page: parseInt(opts.page),
        };
        if (opts.status) query.status = opts.status;

        const res = await client.get<PagePaginatedResponse<PaymentRequestResponse>>(
          '/v1/payment-requests',
          query,
        );

        spinner.stop();

        if (output.isJsonMode()) {
          output.printData(res);
          return;
        }

        const rows = res.data.map((pr) => ({
          id: pr.id,
          amount: formatCurrency(pr.amount, pr.currency),
          status: pr.status,
          purpose: (pr.purpose || '').slice(0, 30),
          created: pr.created_at.split('T')[0],
        }));

        output.printTable(rows);

        if (res.meta) {
          output.info(`Page ${res.meta.current_page} of ${res.meta.last_page} (${res.meta.total} total)`);
        }
      } catch (err) {
        handleError(err);
      }
    });

  payment
    .command('cancel <id>')
    .description('Cancel/delete a pending payment request')
    .action(async (id: string, _, cmd) => {
      try {
        const client = await createClientFromCmd(cmd);

        const spinner = createSpinner('Canceling payment...');
        spinner.start();

        await client.delete(`/v1/payment-requests/${id}`);

        spinner.succeed(`Payment request ${id} canceled`);
      } catch (err) {
        handleError(err);
      }
    });
}
