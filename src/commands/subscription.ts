import { Command } from 'commander';
import type { RecurringBillingResponse, PagePaginatedResponse } from 'hitpay-mcp/types';
import { formatCurrency } from 'hitpay-mcp/formatters';
import { createClient } from '../lib/client.js';
import { createSpinner } from '../lib/spinner.js';
import * as output from '../lib/output.js';
import { handleError } from '../lib/errors.js';

export function registerSubscription(program: Command): void {
  const sub = program
    .command('subscription')
    .description('Manage recurring billing / subscriptions');

  sub
    .command('create')
    .description('Create a recurring billing subscription')
    .requiredOption('--plan-id <id>', 'Subscription plan ID')
    .requiredOption('--customer-email <email>', 'Customer email')
    .option('--customer-name <name>', 'Customer name')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--send-email', 'Send notification email')
    .action(async (opts, cmd) => {
      try {
        const globalOpts = cmd.parent?.parent?.opts() || {};
        const client = createClient({ environment: globalOpts.env });

        const spinner = createSpinner('Creating subscription...');
        spinner.start();

        const body: Record<string, unknown> = {
          plan_id: opts.planId,
          customer_email: opts.customerEmail,
        };
        if (opts.customerName) body.customer_name = opts.customerName;
        if (opts.startDate) body.start_date = opts.startDate;
        if (opts.sendEmail) body.send_email = true;

        const billing = await client.post<RecurringBillingResponse>('/v1/recurring-billing', body);

        spinner.stop();

        if (output.isJsonMode()) {
          output.printData(billing);
          return;
        }

        output.success(`Subscription created: ${billing.id}`);
        output.printData({
          id: billing.id,
          name: billing.name,
          amount: formatCurrency(billing.amount, billing.currency),
          cycle: billing.cycle,
          status: billing.status,
          customer: billing.customer_email || '—',
          url: billing.url || '—',
        });
      } catch (err) {
        handleError(err);
      }
    });

  sub
    .command('list')
    .description('List subscriptions')
    .option('--status <status>', 'Filter: active, cancelled, paused, expired')
    .option('--limit <n>', 'Number of results', '25')
    .action(async (opts, cmd) => {
      try {
        const globalOpts = cmd.parent?.parent?.opts() || {};
        const client = createClient({ environment: globalOpts.env });

        const spinner = createSpinner('Fetching subscriptions...');
        spinner.start();

        const query: Record<string, string | number> = {
          per_page: parseInt(opts.limit),
        };
        if (opts.status) query.status = opts.status;

        const res = await client.get<PagePaginatedResponse<RecurringBillingResponse>>(
          '/v1/recurring-billing',
          query,
        );

        spinner.stop();

        if (output.isJsonMode()) {
          output.printData(res);
          return;
        }

        const rows = res.data.map((b) => ({
          id: b.id.slice(0, 12) + '...',
          name: b.name,
          amount: formatCurrency(b.amount, b.currency),
          cycle: b.cycle,
          status: b.status,
          customer: b.customer_email || '—',
        }));

        output.printTable(rows);

        if (res.meta) {
          output.info(`Page ${res.meta.current_page} of ${res.meta.last_page} (${res.meta.total} total)`);
        }
      } catch (err) {
        handleError(err);
      }
    });

  sub
    .command('get <id>')
    .description('Get subscription details')
    .action(async (id: string, _, cmd) => {
      try {
        const globalOpts = cmd.parent?.parent?.opts() || {};
        const client = createClient({ environment: globalOpts.env });

        const spinner = createSpinner('Fetching subscription...');
        spinner.start();

        const b = await client.get<RecurringBillingResponse>(`/v1/recurring-billing/${id}`);

        spinner.stop();

        if (output.isJsonMode()) {
          output.printData(b);
          return;
        }

        output.printData({
          id: b.id,
          name: b.name,
          description: b.description || '—',
          amount: formatCurrency(b.amount, b.currency),
          cycle: b.cycle,
          status: b.status,
          times_charged: `${b.times_charged || 0}${b.times_to_be_charged ? ` / ${b.times_to_be_charged}` : ''}`,
          customer: b.customer_email || '—',
          url: b.url || '—',
          created: b.created_at,
        });
      } catch (err) {
        handleError(err);
      }
    });

  sub
    .command('cancel <id>')
    .description('Cancel a subscription')
    .action(async (id: string, _, cmd) => {
      try {
        const globalOpts = cmd.parent?.parent?.opts() || {};
        const client = createClient({ environment: globalOpts.env });

        const spinner = createSpinner('Canceling subscription...');
        spinner.start();

        await client.delete(`/v1/recurring-billing/${id}`);

        spinner.succeed(`Subscription ${id} canceled`);
      } catch (err) {
        handleError(err);
      }
    });
}
