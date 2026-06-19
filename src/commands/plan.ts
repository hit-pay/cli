import { Command } from 'commander';
import { formatCurrency } from '../lib/hitpay/formatters.js';
import { createClient } from '../lib/client.js';
import { createSpinner } from '../lib/spinner.js';
import * as output from '../lib/output.js';
import { handleError } from '../lib/errors.js';

interface SubscriptionPlanResponse {
  id: string;
  name: string;
  description?: string;
  currency: string;
  amount: number | string;
  cycle: string;
  cycle_repeat?: number;
  status?: string;
  created_at: string;
  updated_at?: string;
}

interface PaginatedPlans {
  data: SubscriptionPlanResponse[];
  meta?: { current_page: number; last_page: number; total: number };
}

export function registerPlan(program: Command): void {
  const plan = program
    .command('plan')
    .description('Manage subscription plans');

  plan
    .command('create')
    .description('Create a subscription plan')
    .requiredOption('--name <name>', 'Plan name')
    .requiredOption('--amount <amount>', 'Plan amount')
    .requiredOption('--currency <currency>', 'Currency code')
    .requiredOption('--cycle <cycle>', 'Billing cycle: weekly, monthly, yearly')
    .option('--description <desc>', 'Plan description')
    .option('--cycle-repeat <n>', 'Number of billing cycles (0 = unlimited)')
    .action(async (opts, cmd) => {
      try {
        const globalOpts = cmd.parent?.parent?.opts() || {};
        const client = createClient({ environment: globalOpts.env });

        const spinner = createSpinner('Creating plan...');
        spinner.start();

        const body: Record<string, unknown> = {
          name: opts.name,
          amount: parseFloat(opts.amount),
          currency: opts.currency.toUpperCase(),
          cycle: opts.cycle,
        };
        if (opts.description) body.description = opts.description;
        if (opts.cycleRepeat) body.cycle_repeat = parseInt(opts.cycleRepeat);

        const p = await client.post<SubscriptionPlanResponse>('/v1/subscription-plan', body);

        spinner.stop();

        if (output.isJsonMode()) {
          output.printData(p);
          return;
        }

        output.success(`Plan created: ${p.id}`);
        output.printData({
          id: p.id,
          name: p.name,
          amount: formatCurrency(p.amount, p.currency),
          cycle: p.cycle,
        });
      } catch (err) {
        handleError(err);
      }
    });

  plan
    .command('list')
    .description('List subscription plans')
    .action(async (_, cmd) => {
      try {
        const globalOpts = cmd.parent?.parent?.opts() || {};
        const client = createClient({ environment: globalOpts.env });

        const spinner = createSpinner('Fetching plans...');
        spinner.start();

        const res = await client.get<PaginatedPlans>('/v1/subscription-plan');

        spinner.stop();

        if (output.isJsonMode()) {
          output.printData(res);
          return;
        }

        const rows = res.data.map((p) => ({
          id: p.id.slice(0, 12) + '...',
          name: p.name,
          amount: formatCurrency(p.amount, p.currency),
          cycle: p.cycle,
          status: p.status || '—',
        }));

        output.printTable(rows);
      } catch (err) {
        handleError(err);
      }
    });

  plan
    .command('get <id>')
    .description('Get subscription plan details')
    .action(async (id: string, _, cmd) => {
      try {
        const globalOpts = cmd.parent?.parent?.opts() || {};
        const client = createClient({ environment: globalOpts.env });

        const spinner = createSpinner('Fetching plan...');
        spinner.start();

        const p = await client.get<SubscriptionPlanResponse>(`/v1/subscription-plan/${id}`);

        spinner.stop();

        if (output.isJsonMode()) {
          output.printData(p);
          return;
        }

        output.printData({
          id: p.id,
          name: p.name,
          description: p.description || '—',
          amount: formatCurrency(p.amount, p.currency),
          cycle: p.cycle,
          cycle_repeat: p.cycle_repeat ?? 'unlimited',
          created: p.created_at,
        });
      } catch (err) {
        handleError(err);
      }
    });

  plan
    .command('delete <id>')
    .description('Delete a subscription plan')
    .action(async (id: string, _, cmd) => {
      try {
        const globalOpts = cmd.parent?.parent?.opts() || {};
        const client = createClient({ environment: globalOpts.env });

        const spinner = createSpinner('Deleting plan...');
        spinner.start();

        await client.delete(`/v1/subscription-plan/${id}`);

        spinner.succeed(`Plan ${id} deleted`);
      } catch (err) {
        handleError(err);
      }
    });
}
