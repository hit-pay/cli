import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerEnv } from '../../src/commands/env.js';
import { registerUpgrade } from '../../src/commands/upgrade.js';
import { registerVersion } from '../../src/commands/version.js';
import * as cliVersion from '../../src/lib/cli-version.js';
import * as output from '../../src/lib/output.js';
import { maybeNotifyUpdate } from '../../src/lib/update-notifier.js';

const cacheFsMock = vi.hoisted(() => ({
  fileContent: null as string | null,
}));

vi.mock('node:fs', () => ({
  existsSync: (path: string) => {
    if (String(path).endsWith('update-check.json')) {
      return cacheFsMock.fileContent !== null;
    }
    return false;
  },
  readFileSync: (path: string) => {
    if (String(path).endsWith('update-check.json')) {
      return cacheFsMock.fileContent ?? '';
    }
    return '';
  },
  writeFileSync: (path: string, data: string) => {
    if (String(path).endsWith('update-check.json')) {
      cacheFsMock.fileContent = data;
    }
  },
  mkdirSync: vi.fn(),
}));

function createProgram(): Command {
  const program = new Command();
  program.option('--json', 'Output results as JSON');
  registerEnv(program);
  registerUpgrade(program);
  registerVersion(program);
  program.hook('preAction', async (_thisCommand, actionCommand) => {
    await maybeNotifyUpdate(actionCommand);
  });
  return program;
}

describe('update notifier', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    cacheFsMock.fileContent = null;
    warnSpy = vi.spyOn(output, 'warn').mockImplementation(() => {});
    fetchSpy = vi.spyOn(cliVersion, 'fetchLatestVersion');
    vi.spyOn(cliVersion, 'getCurrentVersion').mockReturnValue('0.1.0');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('warns when a newer version is available', async () => {
    fetchSpy.mockResolvedValue('0.2.0');
    const program = createProgram();
    await program.parseAsync(['node', 'hitpay', 'env']);

    expect(warnSpy).toHaveBeenCalledWith(
      'A new version of HitPay CLI is available (0.2.0). Run `hitpay upgrade` to update.',
    );
  });

  it('does not warn when already up to date', async () => {
    fetchSpy.mockResolvedValue('0.1.0');
    const program = createProgram();
    await program.parseAsync(['node', 'hitpay', 'env']);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('uses cached result within 24 hours', async () => {
    cacheFsMock.fileContent = JSON.stringify({
      checked_at: Date.now(),
      latest: '0.2.0',
      update_available: true,
    });

    const program = createProgram();
    await program.parseAsync(['node', 'hitpay', 'env']);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      'A new version of HitPay CLI is available (0.2.0). Run `hitpay upgrade` to update.',
    );
  });

  it('skips notification for upgrade and version commands', async () => {
    fetchSpy.mockResolvedValue('0.2.0');
    const program = createProgram();

    await program.parseAsync(['node', 'hitpay', 'upgrade', '--check']);
    await program.parseAsync(['node', 'hitpay', 'version', '--check']);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('skips notification in JSON mode', async () => {
    fetchSpy.mockResolvedValue('0.2.0');
    const program = createProgram();
    await program.parseAsync(['node', 'hitpay', 'env', '--json']);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('ignores registry errors silently', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    const cmd = new Command('env');

    await expect(maybeNotifyUpdate(cmd)).resolves.toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
