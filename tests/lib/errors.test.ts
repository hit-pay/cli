import { describe, it, expect, vi } from 'vitest';
import { HitPayApiError } from 'hitpay-mcp/client';

describe('HitPayApiError', () => {
  it('creates error with status code and message', () => {
    const err = new HitPayApiError(401, { message: 'Unauthorized' }, '/v1/test');
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Unauthorized');
    expect(err.errorCode).toBe('HITPAY_401');
    expect(err.suggestion).toContain('API key');
  });

  it('includes validation details', () => {
    const err = new HitPayApiError(
      422,
      {
        message: 'Validation failed',
        errors: { amount: ['required', 'must be positive'] },
      },
      '/v1/payment-requests',
    );
    expect(err.details).toEqual({ amount: ['required', 'must be positive'] });
    expect(err.suggestion).toContain('Validation');
  });

  it('handles 404 with endpoint info', () => {
    const err = new HitPayApiError(404, { message: 'Not found' }, '/v1/payment-requests/abc');
    expect(err.suggestion).toContain('/v1/payment-requests/abc');
  });

  it('handles server errors', () => {
    const err = new HitPayApiError(503, { message: 'Service unavailable' }, '/v1/balances');
    expect(err.suggestion).toContain('experiencing issues');
  });
});
