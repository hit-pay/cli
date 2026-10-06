import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerUpgrade } from '../../src/commands/upgrade.js';
import * as cliVersion from '../../src/lib/cli-version.js';
import { CLI_PACKAGE_NAME } from '../../src/lib/package-meta.js';
import * as output from '../../src/lib/output.js';

const CURRENT_VERSION = cliVersion.getCurrentVersion();

function createUpgradeProgram(): Command {
  const program = new Command();
  program.option('--json', 'Output results as JSON');
  registerUpgrade(program);
  return program;
}

describe('hitpay upgrade command', () => {
  let printDataSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let successSpy: ReturnType<typeof vi.spyOn>;
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let installSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    printDataSpy = vi.spyOn(output, 'printData').mockImplementation(() => {});
    infoSpy = vi.spyOn(output, 'info').mockImplementation(() => {});
    successSpy = vi.spyOn(output, 'success').mockImplementation(() => {});
    fetchSpy = vi.spyOn(cliVersion, 'fetchLatestVersion');
    installSpy = vi.spyOn(cliVersion, 'runNpmGlobalInstall').mockResolvedValue(undefined);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('installs latest version when an update is available', async () => {
    fetchSpy.mockResolvedValue('0.2.0');

    await createUpgradeProgram().parseAsync(['node', 'hitpay', 'upgrade']);

    expect(fetchSpy).toHaveBeenCalled();
    expect(installSpy).toHaveBeenCalledWith('0.2.0');
    expect(infoSpy).toHaveBeenCalledWith(
      `Upgrading ${CLI_PACKAGE_NAME} ${CURRENT_VERSION} → 0.2.0...`,
    );
    expect(successSpy).toHaveBeenCalledWith(`Upgraded to ${CLI_PACKAGE_NAME}@0.2.0`);
  });

  it('skips install when already up to date', async () => {
    fetchSpy.mockResolvedValue(CURRENT_VERSION);

    await createUpgradeProgram().parseAsync(['node', 'hitpay', 'upgrade']);

    expect(installSpy).not.toHaveBeenCalled();
    expect(successSpy).toHaveBeenCalledWith(
      `HitPay CLI is already up to date (${CURRENT_VERSION})`,
    );
  });

  it('supports check-only mode', async () => {
    fetchSpy.mockResolvedValue('0.2.0');

    await createUpgradeProgram().parseAsync(['node', 'hitpay', 'upgrade', '--check']);

    expect(installSpy).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(`Update available: ${CURRENT_VERSION} → 0.2.0`);
    expect(infoSpy).toHaveBeenCalledWith('Run `hitpay upgrade` to install the latest version.');
  });

  it('returns JSON for check-only mode', async () => {
    fetchSpy.mockResolvedValue('0.2.0');

    await createUpgradeProgram().parseAsync(['node', 'hitpay', 'upgrade', '--check', '--json']);

    expect(printDataSpy).toHaveBeenCalledWith({
      current: CURRENT_VERSION,
      latest: '0.2.0',
      update_available: true,
    });
  });

  it('does not install in JSON mode and explains why', async () => {
    fetchSpy.mockResolvedValue('0.2.0');

    await createUpgradeProgram().parseAsync(['node', 'hitpay', 'upgrade', '--json']);

    expect(installSpy).not.toHaveBeenCalled();
    expect(printDataSpy).toHaveBeenCalledWith({
      current: CURRENT_VERSION,
      latest: '0.2.0',
      updated: false,
      message: 'Re-run without --json to perform the upgrade.',
    });
  });

  it('handles install failures', async () => {
    fetchSpy.mockResolvedValue('0.2.0');
    installSpy.mockRejectedValue(new Error('permission denied'));

    await createUpgradeProgram().parseAsync(['node', 'hitpay', 'upgrade']);

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
