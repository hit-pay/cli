import { Command } from 'commander';
import chalk from 'chalk';
import type { WebhookEventResponse } from '../lib/hitpay/types.js';
import { createClient } from '../lib/client.js';
import { createSpinner } from '../lib/spinner.js';
import * as output from '../lib/output.js';
import { handleError } from '../lib/errors.js';
import { createWebhookServer } from '../listen/server.js';
import { createTunnel } from '../listen/tunnel.js';
import { forwardEvent, ForwardResult } from '../listen/forwarder.js';
import { printEvent } from '../listen/printer.js';

export function registerListen(program: Command): void {
  program
    .command('listen')
    .description('Listen for webhook events and forward to your local server')
    .requiredOption('--forward-to <url>', 'Local URL to forward events to (e.g. http://localhost:3000/webhook)')
    .option('--events <events...>', 'Events to listen for')
    .option('--port <port>', 'Local port for the webhook receiver', '0')
    .action(async (opts, cmd) => {
      try {
        const globalOpts = cmd.parent?.opts() || {};
        const client = createClient({ environment: globalOpts.env });
        const forwardUrl = opts.forwardTo;
        const eventFilter = opts.events ? opts.events.map((e: string) => e.trim()) : undefined;

        let webhookId: string | undefined;
        let tunnelRef: { close: () => Promise<void> } | undefined;
        let serverRef: { stop: () => Promise<void> } | undefined;

        // Cleanup handler
        const cleanup = async () => {
          console.log(chalk.dim('\nShutting down...'));

          if (webhookId) {
            try {
              await client.delete(`/v1/webhook-events/${webhookId}`);
              console.log(chalk.dim('Webhook endpoint removed.'));
            } catch {
              // Best effort cleanup
            }
          }

          if (tunnelRef) {
            await tunnelRef.close();
          }

          if (serverRef) {
            await serverRef.stop();
          }

          process.exit(0);
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

        const spinner = createSpinner('Setting up webhook listener...');
        spinner.start();

        // 1. Start local HTTP server
        const { start, stop, server } = createWebhookServer(async (event) => {
          // Filter events if specified
          const eventObject = String(event.headers['hitpay-event-object'] || '');
          const eventType = String(event.headers['hitpay-event-type'] || '');
          const eventName = `${eventObject}.${eventType}`;
          if (eventFilter && !eventFilter.includes(eventName)) {
            return;
          }

          // Forward to user's dev server
          let result: ForwardResult | undefined;
          try {
            result = await forwardEvent(event, forwardUrl);
          } catch (err) {
            output.error(`Forward failed: ${err instanceof Error ? err.message : err}`);
          }

          // Print event in terminal
          printEvent(event, result);
          return result;
        });

        serverRef = { stop };
        const port = await start(parseInt(opts.port));

        // 2. Create tunnel
        spinner.text = 'Creating tunnel...';
        const tunnel = await createTunnel(port);
        tunnelRef = tunnel;

        // 3. Register webhook with HitPay
        spinner.text = 'Registering webhook endpoint...';
        const webhookBody: Record<string, unknown> = {
          name: `Testing Webhook for ${forwardUrl}`,
          url: tunnel.url,
        };
        if (eventFilter) {
          webhookBody.event_types = eventFilter;
        }

        const webhook = await client.post<WebhookEventResponse>('/v1/webhook-events', webhookBody);
        webhookId = webhook.id;

        spinner.stop();

        // Ready!
        const env = client.environment;
        console.log(chalk.bold.green('\n  Ready! Listening for webhooks\n'));
        console.log(`  Environment:  ${env === 'production' ? chalk.red(env) : chalk.yellow(env)}`);
        console.log(`  Tunnel URL:   ${chalk.cyan(tunnel.url)}`);
        console.log(`  Forward to:   ${chalk.cyan(forwardUrl)}`);
        console.log(`  Webhook ID:   ${chalk.dim(webhookId)}`);
        if (eventFilter) {
          console.log(`  Events:       ${eventFilter.join(', ')}`);
        }
        console.log(chalk.dim('\n  Press Ctrl+C to stop\n'));
        console.log(chalk.dim('─'.repeat(60)));
        console.log();
      } catch (err) {
        handleError(err);
      }
    });
}
