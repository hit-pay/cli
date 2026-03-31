import { describe, it, expect } from 'vitest';
import { EVENT_FIXTURES, AVAILABLE_EVENTS } from '../../src/trigger/fixtures.js';

describe('Trigger fixtures', () => {
  it('has at least 5 event types', () => {
    expect(AVAILABLE_EVENTS.length).toBeGreaterThanOrEqual(5);
  });

  it('every event has a fixture', () => {
    for (const event of AVAILABLE_EVENTS) {
      expect(EVENT_FIXTURES[event]).toBeDefined();
      expect(EVENT_FIXTURES[event].event).toBe(event);
    }
  });

  it('fixtures have required fields', () => {
    for (const [name, fixture] of Object.entries(EVENT_FIXTURES)) {
      expect(fixture.event).toBe(name);
      expect(fixture.status).toBeDefined();
      expect(fixture.hmac).toBeDefined();
      expect(fixture.created_at).toBeDefined();
    }
  });

  it('payment_request.completed fixture has payment fields', () => {
    const fixture = EVENT_FIXTURES['payment_request.completed'];
    expect(fixture.payment_request_id).toBeDefined();
    expect(fixture.amount).toBeDefined();
    expect(fixture.currency).toBe('SGD');
    expect(fixture.payment_method).toBe('paynow_online');
  });

  it('transfer.paid fixture has transfer fields', () => {
    const fixture = EVENT_FIXTURES['transfer.paid'];
    expect(fixture.transfer_id).toBeDefined();
    expect(fixture.amount).toBeDefined();
    expect(fixture.status).toBe('paid');
  });
});
