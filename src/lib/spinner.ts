import ora from 'ora';
import { isJsonMode } from './output.js';

export function createSpinner(text: string) {
  if (isJsonMode()) {
    // No spinner in JSON mode — return a noop
    return {
      start() { return this; },
      stop() { return this; },
      succeed(t?: string) { return this; },
      fail(t?: string) { return this; },
    };
  }
  return ora(text);
}
