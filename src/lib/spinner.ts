import ora, { type Ora } from 'ora';
import { isJsonMode } from './output.js';

export interface CliSpinner {
  text: string;
  start(): CliSpinner;
  stop(): CliSpinner;
  succeed(text?: string): CliSpinner;
  fail(text?: string): CliSpinner;
}

export interface CreateSpinnerOptions {
  /** Keep stdin usable (recommended for long waits like OAuth login). */
  discardStdin?: boolean;
}

function releaseStdin(): void {
  if (!process.stdin.isTTY) {
    return;
  }

  if (typeof process.stdin.setRawMode === 'function' && process.stdin.isRaw) {
    process.stdin.setRawMode(false);
  }

  // Do not resume stdin — that keeps the event loop alive after one-shot commands.
  process.stdin.pause();
  if (typeof process.stdin.unref === 'function') {
    process.stdin.unref();
  }
}

function attachStdinCleanup(spinner: Ora): CliSpinner {
  const wrapped: CliSpinner = {
    get text() {
      return spinner.text;
    },
    set text(value: string) {
      spinner.text = value;
    },
    start() {
      spinner.start();
      return wrapped;
    },
    stop() {
      spinner.stop();
      releaseStdin();
      return wrapped;
    },
    succeed(text?: string) {
      spinner.succeed(text);
      releaseStdin();
      return wrapped;
    },
    fail(text?: string) {
      spinner.fail(text);
      releaseStdin();
      return wrapped;
    },
  };
  return wrapped;
}

export function createSpinner(text: string, options: CreateSpinnerOptions = {}): CliSpinner {
  if (isJsonMode()) {
    let spinnerText = text;
    const noop: CliSpinner = {
      get text() {
        return spinnerText;
      },
      set text(value: string) {
        spinnerText = value;
      },
      start() {
        return noop;
      },
      stop() {
        return noop;
      },
      succeed(_t?: string) {
        return noop;
      },
      fail(_t?: string) {
        return noop;
      },
    };
    return noop;
  }
  return attachStdinCleanup(
    ora({
      text,
      ...(options.discardStdin !== undefined ? { discardStdin: options.discardStdin } : {}),
    }),
  );
}
