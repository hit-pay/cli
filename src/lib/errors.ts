import { HitPayApiError } from 'hitpay-mcp/client';
import * as output from './output.js';

export function handleError(err: unknown): never {
  if (err instanceof HitPayApiError) {
    output.error(`${err.message} (${err.errorCode})`);
    if (err.suggestion) {
      console.error(`  ${err.suggestion}`);
    }
    if (err.details) {
      for (const [field, messages] of Object.entries(err.details)) {
        console.error(`  ${field}: ${messages.join(', ')}`);
      }
    }
    process.exit(1);
  }

  if (err instanceof Error) {
    output.error(err.message);
    process.exit(1);
  }

  output.error(String(err));
  process.exit(1);
}
