import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';

export interface WebhookEvent {
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
  receivedAt: Date;
}

export type EventHandler = (event: WebhookEvent) => void;

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

      onEvent({
        headers: req.headers as Record<string, string | string[] | undefined>,
        body,
        receivedAt: new Date(),
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch {
      res.writeHead(500);
      res.end('Internal error');
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
