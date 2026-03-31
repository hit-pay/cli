import { Command } from 'commander';
import { setJsonMode } from './lib/output.js';
import { handleError } from './lib/errors.js';
import { registerLogin, registerLogout, registerWhoami } from './commands/login.js';
import { registerConfig } from './commands/config.js';
import { registerBalance } from './commands/balance.js';
import { registerAccount } from './commands/account.js';
import { registerPayment } from './commands/payment.js';
import { registerCharge } from './commands/charge.js';
import { registerRefund } from './commands/refund.js';
import { registerCustomer } from './commands/customer.js';
import { registerInvoice } from './commands/invoice.js';
import { registerPlan } from './commands/plan.js';
import { registerSubscription } from './commands/subscription.js';
import { registerBeneficiary } from './commands/beneficiary.js';
import { registerTransfer } from './commands/transfer.js';
import { registerQr } from './commands/qr.js';
import { registerMethods } from './commands/methods.js';
import { registerListen } from './commands/listen.js';
import { registerTrigger } from './commands/trigger.js';

const program = new Command();

program
  .name('hitpay')
  .description('HitPay CLI — manage payments, test webhooks, and generate QR codes')
  .version('0.1.0')
  .option('--json', 'Output results as JSON')
  .option('--env <environment>', 'Override environment (sandbox or production)')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.json) setJsonMode(true);
  });

// Auth & config
registerLogin(program);
registerLogout(program);
registerWhoami(program);
registerConfig(program);

// Account
registerBalance(program);
registerAccount(program);

// Payments
registerPayment(program);
registerCharge(program);
registerRefund(program);

// Customers
registerCustomer(program);

// Invoices
registerInvoice(program);

// Subscriptions
registerPlan(program);
registerSubscription(program);

// Payouts
registerBeneficiary(program);
registerTransfer(program);

// QR & methods
registerQr(program);
registerMethods(program);

// Webhooks
registerListen(program);
registerTrigger(program);

program.parseAsync(process.argv).catch(handleError);
