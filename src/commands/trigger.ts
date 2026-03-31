import { Command } from 'commander';
import chalk from 'chalk';
import { EVENT_FIXTURES, AVAILABLE_EVENTS } from '../trigger/fixtures.js';
import * as output from '../lib/output.js';
import { handleError } from '../lib/errors.js';

export function registerTrigger(program: Command): void {
  program
    .command('trigger [event]')
    .description('Send a test webhook event to a URL')
    .option('--url <url>', 'Target URL to send the event to', 'http://localhost:3000/webhook')
    .option('--list', 'List available event types')
    .action(async (event: string | undefined, opts) => {
      try {
        if (opts.list || !event) {
          if (output.isJsonMode()) {
            output.printData(AVAILABLE_EVENTS);
            return;
          }

          console.log(chalk.bold('\nAvailable webhook events:\n'));
          for (const e of AVAILABLE_EVENTS) {
            console.log(`  ${chalk.cyan(e)}`);
          }
          console.log(`\nUsage: ${chalk.dim('hitpay trigger <event> --url http://localhost:3000/webhook')}`);
          return;
        }

        const fixture = EVENT_FIXTURES[event];
        if (!fixture) {
          output.error(`Unknown event type: ${event}`);
          console.error(`Available: ${AVAILABLE_EVENTS.join(', ')}`);
          process.exit(1);
        }

        const targetUrl = opts.url;

        if (output.isJsonMode()) {
          // In JSON mode, just output the fixture
          output.printData(fixture);
          return;
        }

        output.info(`Sending ${chalk.cyan(event)} to ${targetUrl}...`);

        const res = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Hitpay-Event-Type': event,
            'Hitpay-Event-Object': 'event',
          },
          body: JSON.stringify(fixture),
        });

        if (res.ok) {
          output.success(`Event sent → ${res.status} (${res.statusText})`);
        } else {
          output.error(`Event sent but got ${res.status} (${res.statusText})`);
        }
      } catch (err) {
        if (err instanceof TypeError && (err as Error).message.includes('fetch')) {
          output.error(`Cannot reach ${opts.url}. Is your server running?`);
          process.exit(1);
        }
        handleError(err);
      }
    });
}
