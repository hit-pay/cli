import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerHelp } from '../../src/commands/help.js';
import { registerEnv } from '../../src/commands/env.js';
import { registerConfig } from '../../src/commands/config.js';
import { registerLogin, registerLogout, registerWhoami } from '../../src/commands/login.js';

function createHelpProgram(): Command {
  const program = new Command();
  program.name('hitpay').description('HitPay CLI').version('0.1.0');
  registerEnv(program);
  registerLogin(program);
  registerLogout(program);
  registerWhoami(program);
  registerConfig(program);
  registerHelp(program);
  return program;
}

describe('hitpay help', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows expanded auth and config details in overview', async () => {
    await createHelpProgram().parseAsync(['node', 'hitpay', 'help']);

    const output = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');

    expect(output).toContain('Authentication & configuration');
    expect(output).toContain('hitpay env');
    expect(output).toContain('hitpay env use <environment>');
    expect(output).toContain('hitpay config set <key> <value>');
    expect(output).toContain('api_key, salt');
    expect(output).toContain('hitpay env use <env>` to switch');
  });
});
