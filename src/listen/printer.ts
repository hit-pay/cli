import chalk from 'chalk';
import type { WebhookEvent } from './server.js';
import type { ForwardResult } from './forwarder.js';

export function printEvent(event: WebhookEvent, forwardResult?: ForwardResult): void {
  const time = event.receivedAt.toISOString().split('T')[1].replace('Z', '');
  const eventType = String(event.headers['hitpay-event-type'] || event.body.event || 'unknown');
  const status = String(event.body.status || '');

  // Event header
  console.log(
    chalk.dim(time) +
    ' ' +
    chalk.bold.cyan(eventType) +
    (status ? ` [${statusColor(status)}]` : ''),
  );

  // Key fields
  const body = event.body;
  if (body.payment_request_id) console.log(chalk.dim(`  payment_request_id: ${body.payment_request_id}`));
  if (body.charge_id) console.log(chalk.dim(`  charge_id: ${body.charge_id}`));
  if (body.amount) console.log(chalk.dim(`  amount: ${body.amount} ${body.currency || ''}`));
  if (body.payment_method) console.log(chalk.dim(`  payment_method: ${body.payment_method}`));

  // Forward result
  if (forwardResult) {
    const arrow = forwardResult.ok
      ? chalk.green(`→ ${forwardResult.status}`)
      : chalk.red(`→ ${forwardResult.status}`);
    console.log(chalk.dim(`  forwarded ${arrow} ${chalk.dim(`(${forwardResult.duration}ms)`)}`));
  }

  console.log();
}

function statusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'succeeded':
    case 'paid':
      return chalk.green(status);
    case 'failed':
    case 'rejected':
      return chalk.red(status);
    case 'pending':
      return chalk.yellow(status);
    default:
      return status;
  }
}
