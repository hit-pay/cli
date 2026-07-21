import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerVersion } from '../../src/commands/version.js';
import * as cliVersion from '../../src/lib/cli-version.js';
import { CLI_PACKAGE_NAME } from '../../src/lib/package-meta.js';
import * as output from '../../src/lib/output.js';

function createVersionProgram(): Command {
  const program = new Command();
  program.option('--json', 'Output results as JSON');
  registerVersion(program);
  return program;
}

describe('hitpay version command', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let printDataSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printDataSpy = vi.spyOn(output, 'printData').mockImplementation(() => {});
    infoSpy = vi.spyOn(output, 'info').mockImplementation(() => {});
    fetchSpy = vi.spyOn(cliVersion, 'fetchLatestVersion');
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints current version', async () => {
    await createVersionProgram().parseAsync(['node', 'hitpay', 'version']);

    expect(logSpy).toHaveBeenCalledWith(`${CLI_PACKAGE_NAME} v0.1.0`);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('prints current version as JSON', async () => {
    await createVersionProgram().parseAsync(['node', 'hitpay', 'version', '--json']);

    expect(printDataSpy).toHaveBeenCalledWith({ current: '0.1.0' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('checks latest version when --check is set', async () => {
    fetchSpy.mockResolvedValue('0.2.0');

    await createVersionProgram().parseAsync(['node', 'hitpay', 'version', '--check']);

    expect(fetchSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(`${CLI_PACKAGE_NAME} v0.1.0`);
    expect(infoSpy).toHaveBeenCalledWith(
      'Latest version: 0.2.0 (update available — run `hitpay upgrade`)',
    );
  });

  it('reports up to date when latest matches current', async () => {
    fetchSpy.mockResolvedValue('0.1.0');

    await createVersionProgram().parseAsync(['node', 'hitpay', 'version', '--check']);

    expect(infoSpy).toHaveBeenCalledWith('Latest version: 0.1.0 (up to date)');
  });

  it('returns JSON payload when checking with --json', async () => {
    fetchSpy.mockResolvedValue('0.2.0');

    await createVersionProgram().parseAsync(['node', 'hitpay', 'version', '--check', '--json']);

    expect(printDataSpy).toHaveBeenCalledWith({
      current: '0.1.0',
      latest: '0.2.0',
      update_available: true,
    });
  });

  it('handles registry errors', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));

    await createVersionProgram().parseAsync(['node', 'hitpay', 'version', '--check']);

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
