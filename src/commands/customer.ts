import { Command } from 'commander';
import type { CustomerResponse, CursorPaginatedResponse } from 'hitpay-mcp/types';
import { createClient } from '../lib/client.js';
import { createSpinner } from '../lib/spinner.js';
import * as output from '../lib/output.js';
import { handleError } from '../lib/errors.js';

export function registerCustomer(program: Command): void {
  const customer = program
    .command('customer')
    .description('Manage customers');

  customer
    .command('create')
    .description('Create a new customer')
    .option('--name <name>', 'Customer name')
    .option('--email <email>', 'Customer email')
    .option('--phone <phone>', 'Customer phone')
    .option('--street <street>', 'Street address')
    .option('--city <city>', 'City')
    .option('--state <state>', 'State')
    .option('--zip <zip>', 'ZIP/postal code')
    .option('--country <country>', 'Country code')
    .action(async (opts, cmd) => {
      try {
        const globalOpts = cmd.parent?.parent?.opts() || {};
        const client = createClient({ environment: globalOpts.env });

        const spinner = createSpinner('Creating customer...');
        spinner.start();

        const body: Record<string, unknown> = {};
        if (opts.name) body.name = opts.name;
        if (opts.email) body.email = opts.email;
        if (opts.phone) body.phone = opts.phone;
        if (opts.street) body.street = opts.street;
        if (opts.city) body.city = opts.city;
        if (opts.state) body.state = opts.state;
        if (opts.zip) body.zip_code = opts.zip;
        if (opts.country) body.country = opts.country;

        const c = await client.post<CustomerResponse>('/v1/customers', body);

        spinner.stop();

        if (output.isJsonMode()) {
          output.printData(c);
          return;
        }

        output.success(`Customer created: ${c.id}`);
        output.printData({
          id: c.id,
          name: c.name || '—',
          email: c.email || '—',
          phone: c.phone || '—',
          country: c.country || '—',
          created: c.created_at,
        });
      } catch (err) {
        handleError(err);
      }
    });

  customer
    .command('list')
    .description('List customers')
    .option('--search <query>', 'Search by name, email, or phone')
    .option('--limit <n>', 'Number of results', '25')
    .action(async (opts, cmd) => {
      try {
        const globalOpts = cmd.parent?.parent?.opts() || {};
        const client = createClient({ environment: globalOpts.env });

        const spinner = createSpinner('Fetching customers...');
        spinner.start();

        const query: Record<string, string | number> = {
          per_page: parseInt(opts.limit),
        };
        if (opts.search) query.keywords = opts.search;

        const res = await client.get<CursorPaginatedResponse<CustomerResponse>>('/v1/customers', query);

        spinner.stop();

        if (output.isJsonMode()) {
          output.printData(res);
          return;
        }

        const rows = res.data.map((c) => ({
          id: c.id.slice(0, 12) + '...',
          name: c.name || '—',
          email: c.email || '—',
          phone: c.phone || '—',
          created: c.created_at.split('T')[0],
        }));

        output.printTable(rows);
      } catch (err) {
        handleError(err);
      }
    });

  customer
    .command('get <id>')
    .description('Get customer details')
    .action(async (id: string, _, cmd) => {
      try {
        const globalOpts = cmd.parent?.parent?.opts() || {};
        const client = createClient({ environment: globalOpts.env });

        const spinner = createSpinner('Fetching customer...');
        spinner.start();

        const c = await client.get<CustomerResponse>(`/v1/customers/${id}`);

        spinner.stop();

        if (output.isJsonMode()) {
          output.printData(c);
          return;
        }

        output.printData({
          id: c.id,
          name: c.name || '—',
          email: c.email || '—',
          phone: c.phone || '—',
          street: c.street || '—',
          city: c.city || '—',
          state: c.state || '—',
          zip_code: c.zip_code || '—',
          country: c.country || '—',
          created: c.created_at,
          updated: c.updated_at,
        });
      } catch (err) {
        handleError(err);
      }
    });

  customer
    .command('update <id>')
    .description('Update customer details')
    .option('--name <name>', 'Customer name')
    .option('--email <email>', 'Customer email')
    .option('--phone <phone>', 'Customer phone')
    .option('--country <country>', 'Country code')
    .action(async (id: string, opts, cmd) => {
      try {
        const globalOpts = cmd.parent?.parent?.opts() || {};
        const client = createClient({ environment: globalOpts.env });

        const spinner = createSpinner('Updating customer...');
        spinner.start();

        const body: Record<string, unknown> = {};
        if (opts.name) body.name = opts.name;
        if (opts.email) body.email = opts.email;
        if (opts.phone) body.phone = opts.phone;
        if (opts.country) body.country = opts.country;

        const c = await client.put<CustomerResponse>(`/v1/customers/${id}`, body);

        spinner.stop();

        output.success(`Customer ${id} updated`);
        if (!output.isJsonMode()) {
          output.printData({ id: c.id, name: c.name, email: c.email });
        } else {
          output.printData(c);
        }
      } catch (err) {
        handleError(err);
      }
    });

  customer
    .command('delete <id>')
    .description('Delete a customer')
    .action(async (id: string, _, cmd) => {
      try {
        const globalOpts = cmd.parent?.parent?.opts() || {};
        const client = createClient({ environment: globalOpts.env });

        const spinner = createSpinner('Deleting customer...');
        spinner.start();

        await client.delete(`/v1/customers/${id}`);

        spinner.succeed(`Customer ${id} deleted`);
      } catch (err) {
        handleError(err);
      }
    });
}
