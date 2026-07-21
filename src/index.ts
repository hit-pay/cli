import { Command } from 'commander';
import { PUBLIC_ENVIRONMENT_NAMES } from './lib/hitpay/environments.js';
import { setJsonMode } from './lib/output.js';
import { handleError } from './lib/errors.js';
import { getGlobalOpts } from './lib/global-options.js';
import { maybeNotifyUpdate } from './lib/update-notifier.js';
import { getCurrentVersion } from './lib/cli-version.js';
import { registerLogin, registerLogout, registerWhoami } from './commands/login.js';
import { registerEnv } from './commands/env.js';
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
import { registerHelp } from './commands/help.js';
import { registerVersion } from './commands/version.js';
import { registerUpgrade } from './commands/upgrade.js';

const program = new Command();

program
  .name('hitpay')
  .description('HitPay CLI — manage payments, test webhooks, and generate QR codes')
  .version(getCurrentVersion())
  .option('--json', 'Output results as JSON')
  .option(
    '--env <environment>',
    `One-off profile override for this command only (${PUBLIC_ENVIRONMENT_NAMES.join(', ')})`,
  )
  .option('--api-key <key>', 'API key override for this command (not saved)')
  .hook('preAction', async (_thisCommand, actionCommand) => {
    const opts = getGlobalOpts(actionCommand);
    if (opts.json) setJsonMode(true);
    await maybeNotifyUpdate(actionCommand);
  });

registerEnv(program);
registerLogin(program);
registerLogout(program);
registerWhoami(program);
registerConfig(program);

registerBalance(program);
registerAccount(program);
registerPayment(program);
registerCharge(program);
registerRefund(program);
registerCustomer(program);
registerInvoice(program);
registerPlan(program);
registerSubscription(program);
registerBeneficiary(program);
registerTransfer(program);
registerQr(program);
registerMethods(program);
registerListen(program);
registerTrigger(program);
registerVersion(program);
registerUpgrade(program);
registerHelp(program);

program.parseAsync(process.argv).catch(handleError);
