import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setJsonMode, isJsonMode, printData, success, error } from '../../src/lib/output.js';

describe('Output module', () => {
  beforeEach(() => {
    setJsonMode(false);
  });

  it('defaults to non-JSON mode', () => {
    expect(isJsonMode()).toBe(false);
  });

  it('can toggle JSON mode', () => {
    setJsonMode(true);
    expect(isJsonMode()).toBe(true);
    setJsonMode(false);
    expect(isJsonMode()).toBe(false);
  });

  it('printData outputs JSON in JSON mode', () => {
    setJsonMode(true);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printData({ foo: 'bar' });
    expect(spy).toHaveBeenCalledWith(JSON.stringify({ foo: 'bar' }, null, 2));
    spy.mockRestore();
  });

  it('printData handles arrays in JSON mode', () => {
    setJsonMode(true);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printData([1, 2, 3]);
    expect(spy).toHaveBeenCalledWith(JSON.stringify([1, 2, 3], null, 2));
    spy.mockRestore();
  });

  it('success prints with checkmark', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    success('done');
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0][0] as string;
    // The output contains a green checkmark (ANSI codes) followed by the message
    expect(output).toContain('done');
    spy.mockRestore();
  });

  it('error prints to stderr', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    error('something broke');
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0][0] as string;
    expect(output).toContain('something broke');
    spy.mockRestore();
  });
});
