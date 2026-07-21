import { Command } from 'commander';
import type { InvoiceResponse, CursorPaginatedResponse } from '../lib/hitpay/types.js';
import { formatCurrency } from '../lib/hitpay/formatters.js';
import { createClientFromCmd } from '../lib/client.js';
import { createSpinner } from '../lib/spinner.js';
import * as output from '../lib/output.js';
import { handleError } from '../lib/errors.js';

export function registerInvoice(program: Command): void {
  const invoice = program
    .command('invoice')
    .description('Manage invoices');

  invoice
    .command('create')
    .description('Create a new invoice')
    .requiredOption('--amount <amount>', 'Invoice amount')
    .requiredOption('--currency <currency>', 'Currency code')
    .option('--customer-email <email>', 'Customer email')
    .option('--customer-name <name>', 'Customer name')
    .option('--customer-id <id>', 'Existing customer ID')
    .option('--due-date <date>', 'Due date (YYYY-MM-DD)')
    .option('--invoice-number <num>', 'Invoice number')
    .option('--reference <ref>', 'Reference')
    .option('--memo <memo>', 'Memo/notes')
    .option('--send-email', 'Send invoice via email')
    .action(async (opts, cmd) => {
      try {
        const client = await createClientFromCmd(cmd);

        const spinner = createSpinner('Creating invoice...');
        spinner.start();

        const body: Record<string, unknown> = {
          amount: parseFloat(opts.amount),
          currency: opts.currency.toUpperCase(),
        };
        if (opts.customerEmail) body.customer_email = opts.customerEmail;
        if (opts.customerName) body.customer_name = opts.customerName;
        if (opts.customerId) body.customer_id = opts.customerId;
        if (opts.dueDate) body.due_date = opts.dueDate;
        if (opts.invoiceNumber) body.invoice_number = opts.invoiceNumber;
        if (opts.reference) body.reference = opts.reference;
        if (opts.memo) body.memo = opts.memo;
        if (opts.sendEmail) body.send_email = true;

        const inv = await client.post<InvoiceResponse>('/v1/invoices', body);

        spinner.stop();

        if (output.isJsonMode()) {
          output.printData(inv);
          return;
        }

        output.success(`Invoice created: ${inv.id}`);
        output.printData({
          id: inv.id,
          amount: formatCurrency(inv.amount, inv.currency),
          status: inv.status,
          customer: inv.customer_email || inv.customer_name || '—',
          invoice_number: inv.invoice_number || '—',
          due_date: inv.due_date || '—',
          url: inv.url || '—',
        });
      } catch (err) {
        handleError(err);
      }
    });

  invoice
    .command('list')
    .description('List invoices')
    .option('--limit <n>', 'Number of results', '25')
    .option('--status <status>', 'Filter by status')
    .action(async (opts, cmd) => {
      try {
        const client = await createClientFromCmd(cmd);

        const spinner = createSpinner('Fetching invoices...');
        spinner.start();

        const query: Record<string, string | number> = {
          per_page: parseInt(opts.limit),
        };
        if (opts.status) query.status = opts.status;

        const res = await client.get<CursorPaginatedResponse<InvoiceResponse>>('/v1/invoices', query);

        spinner.stop();

        if (output.isJsonMode()) {
          output.printData(res);
          return;
        }

        const rows = res.data.map((inv) => ({
          id: inv.id.slice(0, 12) + '...',
          amount: formatCurrency(inv.amount, inv.currency),
          status: inv.status,
          customer: inv.customer_email || inv.customer_name || '—',
          due_date: inv.due_date || '—',
          created: inv.created_at.split('T')[0],
        }));

        output.printTable(rows);
      } catch (err) {
        handleError(err);
      }
    });

  invoice
    .command('delete <id>')
    .description('Delete an invoice')
    .action(async (id: string, _, cmd) => {
      try {
        const client = await createClientFromCmd(cmd);

        const spinner = createSpinner('Deleting invoice...');
        spinner.start();

        await client.delete(`/v1/invoices/${id}`);

        spinner.succeed(`Invoice ${id} deleted`);
      } catch (err) {
        handleError(err);
      }
    });
}
