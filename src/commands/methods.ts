import { Command } from 'commander';
import chalk from 'chalk';
import { formatPaymentMethod } from '../lib/hitpay/formatters.js';
import type { AccountStatusResponse } from '../lib/hitpay/types.js';
import { createClientFromCmd } from '../lib/client.js';
import { createSpinner } from '../lib/spinner.js';
import * as output from '../lib/output.js';
import { handleError } from '../lib/errors.js';

// Country → payment method → currency mapping
const COUNTRY_METHODS: Record<string, { method: string; currency: string }[]> = {
  SG: [
    { method: 'paynow_online', currency: 'SGD' },
    { method: 'grabpay_direct', currency: 'SGD' },
    { method: 'shopee_pay', currency: 'SGD' },
    { method: 'card', currency: 'SGD' },
    { method: 'alipay', currency: 'SGD' },
    { method: 'wechat', currency: 'SGD' },
  ],
  MY: [
    { method: 'fpx', currency: 'MYR' },
    { method: 'grabpay_direct', currency: 'MYR' },
    { method: 'shopee_pay', currency: 'MYR' },
    { method: 'touch_n_go', currency: 'MYR' },
    { method: 'boost', currency: 'MYR' },
    { method: 'duitnow', currency: 'MYR' },
    { method: 'card', currency: 'MYR' },
  ],
  PH: [
    { method: 'gcash', currency: 'PHP' },
    { method: 'qrph_netbank', currency: 'PHP' },
    { method: 'shopee_pay', currency: 'PHP' },
    { method: 'card', currency: 'PHP' },
  ],
  TH: [
    { method: 'promptpay', currency: 'THB' },
    { method: 'truemoney', currency: 'THB' },
    { method: 'card', currency: 'THB' },
  ],
  ID: [
    { method: 'qris', currency: 'IDR' },
    { method: 'card', currency: 'IDR' },
  ],
  VN: [
    { method: 'vietqr', currency: 'VND' },
    { method: 'card', currency: 'VND' },
  ],
  IN: [
    { method: 'upi', currency: 'INR' },
    { method: 'card', currency: 'INR' },
  ],
  AU: [
    { method: 'card', currency: 'AUD' },
  ],
};

export function registerMethods(program: Command): void {
  program
    .command('methods')
    .description('Discover available payment methods')
    .option('--country <code>', 'Filter by country code (SG, MY, PH, TH, ID, VN, IN, AU)')
    .option('--live', 'Show only methods enabled on your account')
    .action(async (opts, cmd) => {
      try {
        if (opts.live) {
          // Fetch live account status to check enabled providers
          const client = await createClientFromCmd(cmd);

          const spinner = createSpinner('Checking enabled methods...');
          spinner.start();

          const status = await client.get<AccountStatusResponse>('/v1/account-status');
          spinner.stop();

          if (output.isJsonMode()) {
            output.printData(status.payment_providers);
            return;
          }

          if (!status.payment_providers) {
            output.info('No payment providers found.');
            return;
          }

          const rows = Object.entries(status.payment_providers)
            .filter(([, p]) => p.payment_enabled)
            .map(([name, p]) => ({
              provider: name,
              status: p.setup_status,
            }));

          console.log(chalk.bold('\nEnabled Payment Providers'));
          output.printTable(rows);
          return;
        }

        // Static method listing by country
        if (opts.country) {
          const code = opts.country.toUpperCase();
          const methods = COUNTRY_METHODS[code];

          if (!methods) {
            output.error(`Unknown country code: ${code}. Supported: ${Object.keys(COUNTRY_METHODS).join(', ')}`);
            process.exit(1);
          }

          if (output.isJsonMode()) {
            output.printData(methods);
            return;
          }

          console.log(chalk.bold(`\nPayment methods for ${code}`));
          const rows = methods.map((m) => ({
            method: m.method,
            display_name: formatPaymentMethod(m.method),
            currency: m.currency,
          }));
          output.printTable(rows);
          return;
        }

        // Show all countries
        if (output.isJsonMode()) {
          output.printData(COUNTRY_METHODS);
          return;
        }

        for (const [country, methods] of Object.entries(COUNTRY_METHODS)) {
          console.log(chalk.bold(`\n${country}`));
          const rows = methods.map((m) => ({
            method: m.method,
            display_name: formatPaymentMethod(m.method),
            currency: m.currency,
          }));
          output.printTable(rows);
        }
      } catch (err) {
        handleError(err);
      }
    });
}
