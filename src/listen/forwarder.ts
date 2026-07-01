import type { WebhookEvent } from './server.js';

export interface ForwardResult {
  status: number;
  ok: boolean;
  message: unknown;
  duration: number;
}

export async function forwardEvent(
  event: WebhookEvent,
  targetUrl: string,
): Promise<ForwardResult> {
  const start = Date.now();

  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Pass through HitPay signature headers
      ...(event.headers['hitpay-signature'] ? { 'hitpay-signature': String(event.headers['hitpay-signature']) } : {}),
      ...(event.headers['hitpay-event-type'] ? { 'hitpay-event-type': String(event.headers['hitpay-event-type']) } : {}),
      ...(event.headers['hitpay-event-object'] ? { 'hitpay-event-object': String(event.headers['hitpay-event-object']) } : {}),
    },
    body: JSON.stringify(event.body),
  });

  const text = await res.text();
  let message: unknown = text;
  try {
    message = JSON.parse(text);
  } catch {
    // Ignore and leave as text
  }

  return {
    status: res.status,
    ok: res.ok,
    message,
    duration: Date.now() - start,
  };
}
