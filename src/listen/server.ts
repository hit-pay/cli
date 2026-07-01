import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { ForwardResult } from './forwarder';

export interface WebhookEvent {
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
  receivedAt: Date;
}

export type EventHandler = (event: WebhookEvent) => Promise<ForwardResult | undefined> | any;

export function createWebhookServer(onEvent: EventHandler): {
  server: ReturnType<typeof createHttpServer>;
  start: (port?: number) => Promise<number>;
  stop: () => Promise<void>;
} {
  const server = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'POST') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('HitPay CLI webhook listener');
      return;
    }

    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const rawBody = Buffer.concat(chunks).toString('utf-8');

      let body: Record<string, unknown>;
      try {
        body = JSON.parse(rawBody);
      } catch {
        // HitPay may send form-encoded data
        body = Object.fromEntries(new URLSearchParams(rawBody));
      }

      const result = await onEvent({
        headers: req.headers as Record<string, string | string[] | undefined>,
        body,
        receivedAt: new Date(),
      });


      if (!result || typeof result !== 'object' || typeof result.status !== 'number') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Event ignored by filter' }));
        return;
      }

      const payload = typeof result.message === 'string' ? result.message : JSON.stringify(result.message);
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(payload);
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500);
        res.end('Internal error');
      }
    }
  });

  return {
    server,
    start: (port = 0) =>
      new Promise((resolve, reject) => {
        server.listen(port, () => {
          const addr = server.address();
          if (typeof addr === 'object' && addr) {
            resolve(addr.port);
          } else {
            reject(new Error('Failed to start server'));
          }
        });
        server.on('error', reject);
      }),
    stop: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      }),
  };
}
