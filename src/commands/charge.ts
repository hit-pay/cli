import { Command } from 'commander';
import type { ChargeResponse, CursorPaginatedResponse } from '../lib/hitpay/types.js';
import { formatCurrency, formatPaymentMethod, redactCard } from '../lib/hitpay/formatters.js';
import { createClientFromCmd } from '../lib/client.js';
import { createSpinner } from '../lib/spinner.js';
import * as output from '../lib/output.js';
import { handleError } from '../lib/errors.js';

export function registerCharge(program: Command): void {
  const charge = program
    .command('charge')
    .description('View transaction history and charge details');

  charge
    .command('list')
    .description('List charges/transactions')
    .option('--limit <n>', 'Number of results', '25')
    .option('--status <status>', 'Filter: succeeded, failed, refunded, partially_refunded, void')
    .option('--date-from <date>', 'Start date (YYYY-MM-DD)')
    .option('--date-to <date>', 'End date (YYYY-MM-DD)')
    .option('--amount-from <n>', 'Minimum amount')
    .option('--amount-to <n>', 'Maximum amount')
    .option('--payment-method <method>', 'Filter by payment method (card, paynow_online, etc.)')
    .option('--keywords <search>', 'Search amount, charge_id, customer_email, remark')
    .option('--customer-id <id>', 'Filter by customer ID')
    .action(async (opts, cmd) => {
      try {
        const client = await createClientFromCmd(cmd);

        const spinner = createSpinner('Fetching charges...');
        spinner.start();

        const query: Record<string, string | number> = {
          perPage: parseInt(opts.limit),
        };
        if (opts.status) query.status = opts.status;
        if (opts.dateFrom) query.date_from = opts.dateFrom;
        if (opts.dateTo) query.date_to = opts.dateTo;
        if (opts.amountFrom) query.amount_from = parseFloat(opts.amountFrom);
        if (opts.amountTo) query.amount_to = parseFloat(opts.amountTo);
        if (opts.paymentMethod) query.payment_method = opts.paymentMethod;
        if (opts.keywords) query.keywords = opts.keywords;
        if (opts.customerId) query.customer_id = opts.customerId;

        const res = await client.get<CursorPaginatedResponse<ChargeResponse>>('/v1/charges', query);

        spinner.stop();

        if (output.isJsonMode()) {
          output.printData(res);
          return;
        }

        const rows = res.data.map((c) => ({
          id: c.id.slice(0, 12) + '...',
          amount: formatCurrency(c.amount, c.currency),
          status: c.status,
          method: c.payment_method?.name ? formatPaymentMethod(c.payment_method.name) : '—',
          customer: c.customer?.email || c.customer?.name || '—',
          date: c.created_at.split('T')[0],
        }));

        output.printTable(rows);
      } catch (err) {
        handleError(err);
      }
    });

  charge
    .command('get <id>')
    .description('Get charge details with fee breakdown')
    .action(async (id: string, _, cmd) => {
      try {
        const client = await createClientFromCmd(cmd);

        const spinner = createSpinner('Fetching charge...');
        spinner.start();

        const c = await client.get<ChargeResponse>(`/v1/charges/${id}`);

        spinner.stop();

        if (output.isJsonMode()) {
          output.printData(c);
          return;
        }

        const methodName = c.payment_method?.name ? formatPaymentMethod(c.payment_method.name) : '—';
        const cardInfo = c.payment_method?.data?.last4
          ? redactCard(c.payment_method.data.brand, c.payment_method.data.last4)
          : undefined;

        output.printData({
          id: c.id,
          amount: formatCurrency(c.amount, c.currency),
          status: c.status,
          payment_method: cardInfo ? `${methodName} (${cardInfo})` : methodName,
          customer: c.customer?.email || c.customer?.name || '—',
          remark: c.remark || '—',
          reference: c.order_reference_number || '—',
          channel: c.channel || '—',
          fixed_fee: c.fixed_fee !== undefined ? formatCurrency(c.fixed_fee, c.currency) : '—',
          discount_fee: c.discount_fee !== undefined ? formatCurrency(c.discount_fee, c.currency) : '—',
          discount_fee_rate: c.discount_fee_rate !== undefined ? `${c.discount_fee_rate}%` : '—',
          created: c.created_at,
        });
      } catch (err) {
        handleError(err);
      }
    });

  charge
    .command('export')
    .description('Export charges (returns data for the specified date range)')
    .option('--date-from <date>', 'Start date (YYYY-MM-DD)')
    .option('--date-to <date>', 'End date (YYYY-MM-DD)')
    .option('--status <status>', 'Filter by status')
    .option('--payment-method <method>', 'Filter by payment method')
    .option('--limit <n>', 'Number of results', '25')
    .action(async (opts, cmd) => {
      try {
        const client = await createClientFromCmd(cmd);

        const spinner = createSpinner('Exporting charges...');
        spinner.start();

        const query: Record<string, string | number> = {
          perPage: parseInt(opts.limit),
        };
        if (opts.dateFrom) query.dateFrom = opts.dateFrom;
        if (opts.dateTo) query.dateTo = opts.dateTo;
        if (opts.status) query['statuses[]'] = opts.status;
        if (opts.paymentMethod) query.payment_method = opts.paymentMethod;

        const res = await client.get<unknown>('/v1/charges/export', query);

        spinner.stop();

        // Export always outputs JSON for piping to file
        console.log(JSON.stringify(res, null, 2));
      } catch (err) {
        handleError(err);
      }
    });
}
