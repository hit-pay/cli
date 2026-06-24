import { Command } from 'commander';
import qrTerminal from 'qrcode-terminal';
import { formatCurrency, formatPaymentMethod } from '../lib/hitpay/formatters.js';
import { createClient } from '../lib/client.js';
import { createSpinner } from '../lib/spinner.js';
import * as output from '../lib/output.js';
import { handleError } from '../lib/errors.js';

interface EmbeddedQrResponse {
  qr_code: string;
  qr_code_expiry?: string | null;
  payment_request_id?: string;
  amount?: string;
  currency?: string;
  payment_method?: string;
  checkout_url?: string;
  borderless_fx?: {
    customer_pays?: string;
    merchant_receives?: string;
    fx_rate?: string;
    customer_currency?: string;
    merchant_currency?: string;
  };
}

export function registerQr(program: Command): void {
  const qr = program
    .command('qr')
    .description('Generate and manage QR codes for payments');

  qr
    .command('create')
    .description('Generate a QR code for payment (displayed in terminal)')
    .requiredOption('--amount <amount>', 'Payment amount')
    .requiredOption('--currency <currency>', 'Currency code')
    .requiredOption('--method <method>', 'Payment method (e.g. paynow_online, grabpay_direct)')
    .option('--name <name>', 'Customer name')
    .option('--email <email>', 'Customer email')
    .option('--reference <ref>', 'Reference number')
    .action(async (opts, cmd) => {
      try {
        const globalOpts = cmd.parent?.parent?.opts() || {};
        const client = createClient({ environment: globalOpts.env });

        const spinner = createSpinner('Generating QR code...');
        spinner.start();

        const body: Record<string, unknown> = {
          amount: parseFloat(opts.amount),
          currency: opts.currency.toUpperCase(),
          payment_method: opts.method,
        };
        if (opts.name) body.name = opts.name;
        if (opts.email) body.email = opts.email;
        if (opts.reference) body.reference_number = opts.reference;

        const res = await client.post<EmbeddedQrResponse>('/v1/qr-code', body);

        spinner.stop();

        if (output.isJsonMode()) {
          output.printData(res);
          return;
        }

        output.success(`QR code generated for ${formatCurrency(opts.amount, opts.currency)}`);
        console.log(`Method: ${formatPaymentMethod(opts.method)}`);

        if (res.qr_code_expiry) {
          console.log(`Expires: ${res.qr_code_expiry}`);
        }

        if (res.borderless_fx) {
          const fx = res.borderless_fx;
          console.log(`FX: Customer pays ${fx.customer_pays} ${fx.customer_currency} → You receive ${fx.merchant_receives} ${fx.merchant_currency} (rate: ${fx.fx_rate})`);
        }

        console.log();

        // Render QR code in terminal
        qrTerminal.generate(res.qr_code, { small: true }, (qr: string) => {
          console.log(qr);
        });

        if (res.checkout_url) {
          console.log(`\nCheckout URL: ${res.checkout_url}`);
        }
      } catch (err) {
        handleError(err);
      }
    });
}
