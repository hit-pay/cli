import { describe, it, expect, afterEach } from 'vitest';
import { createWebhookServer, type WebhookEvent } from '../../src/listen/server.js';

describe('Webhook server', () => {
  let stopServer: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (stopServer) {
      await stopServer();
      stopServer = undefined;
    }
  });

  it('starts on a random port', async () => {
    const events: WebhookEvent[] = [];
    const { start, stop } = createWebhookServer((e) => events.push(e));
    stopServer = stop;

    const port = await start();
    expect(port).toBeGreaterThan(0);
  });

  it('responds to GET with 200', async () => {
    const { start, stop } = createWebhookServer(() => {});
    stopServer = stop;

    const port = await start();
    const res = await fetch(`http://localhost:${port}/`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('webhook listener');
  });

  it('receives POST webhook events', async () => {
    const events: WebhookEvent[] = [];
    const { start, stop } = createWebhookServer((e) => events.push(e));
    stopServer = stop;

    const port = await start();

    const res = await fetch(`http://localhost:${port}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'hitpay-event-type': 'charge.created',
      },
      body: JSON.stringify({ amount: '100', currency: 'SGD', status: 'completed' }),
    });

    expect(res.status).toBe(200);
    expect(events).toHaveLength(1);
    expect(events[0].body.amount).toBe('100');
    expect(events[0].headers['hitpay-event-type']).toBe('charge.created');
  });

  it('handles form-encoded POST body', async () => {
    const events: WebhookEvent[] = [];
    const { start, stop } = createWebhookServer((e) => events.push(e));
    stopServer = stop;

    const port = await start();

    const res = await fetch(`http://localhost:${port}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'amount=50&currency=MYR&status=pending',
    });

    expect(res.status).toBe(200);
    expect(events).toHaveLength(1);
    expect(events[0].body.amount).toBe('50');
    expect(events[0].body.currency).toBe('MYR');
  });
});
