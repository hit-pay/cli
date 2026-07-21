import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

const configFsMock = vi.hoisted(() => ({
  fileContent: null as string | null,
}));

vi.mock('node:fs', () => ({
  existsSync: () => configFsMock.fileContent !== null,
  readFileSync: () => configFsMock.fileContent ?? '',
  writeFileSync: (_path: string, data: string) => {
    configFsMock.fileContent = data;
  },
  mkdirSync: vi.fn(),
  chmodSync: vi.fn(),
}));

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    homedir: () => '/mock/hitpay-home',
  };
});

import { registerEnv } from '../../src/commands/env.js';
import * as output from '../../src/lib/output.js';
import {
  getActiveEnvironment,
  readConfig,
  setGlobalValue,
  writeConfig,
} from '../../src/lib/config.js';

function createEnvProgram(): Command {
  const program = new Command();
  registerEnv(program);
  return program;
}

describe('hitpay env command', () => {
  let printDataSpy: ReturnType<typeof vi.spyOn>;
  let successSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    configFsMock.fileContent = null;
    printDataSpy = vi.spyOn(output, 'printData').mockImplementation(() => {});
    successSpy = vi.spyOn(output, 'success').mockImplementation(() => {});
    errorSpy = vi.spyOn(output, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows active environment when called without subcommand', async () => {
    writeConfig({ environment: 'staging' });

    await createEnvProgram().parseAsync(['node', 'hitpay', 'env']);

    expect(printDataSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        active_environment: 'staging',
        config_path: expect.stringContaining('config.json'),
      }),
    );
  });

  it('defaults to production when config has no environment', async () => {
    await createEnvProgram().parseAsync(['node', 'hitpay', 'env']);

    expect(printDataSpy).toHaveBeenCalledWith(
      expect.objectContaining({ active_environment: 'production' }),
    );
  });

  it('switches active environment via env use and preserves other profiles', async () => {
    writeConfig({
      environment: 'production',
      profiles: {
        production: { api_key: 'sk-live' },
        sandbox: { api_key: 'sk-sandbox' },
      },
    });

    await createEnvProgram().parseAsync(['node', 'hitpay', 'env', 'use', 'sandbox']);

    expect(readConfig().environment).toBe('sandbox');
    expect(readConfig().profiles?.production?.api_key).toBe('sk-live');
    expect(readConfig().profiles?.sandbox?.api_key).toBe('sk-sandbox');
    expect(successSpy).toHaveBeenCalledWith('Active environment set to sandbox');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('accepts all supported environment names', async () => {
    for (const env of ['local', 'staging', 'sandbox', 'production'] as const) {
      configFsMock.fileContent = null;
      await createEnvProgram().parseAsync(['node', 'hitpay', 'env', 'use', env]);
      expect(readConfig().environment).toBe(env);
    }
  });

  it('rejects invalid environment names', async () => {
    await createEnvProgram().parseAsync(['node', 'hitpay', 'env', 'use', 'qa']);

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Environment must be one of'));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe('hitpay env helpers', () => {
  beforeEach(() => {
    configFsMock.fileContent = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('setGlobalValue switches active environment', () => {
    writeConfig({ environment: 'production', profiles: { production: { api_key: 'sk-live' } } });
    setGlobalValue('environment', 'sandbox');

    expect(readConfig().environment).toBe('sandbox');
    expect(readConfig().profiles?.production?.api_key).toBe('sk-live');
  });

  it('defaults to production when environment is unset', () => {
    expect(getActiveEnvironment({})).toBe('production');
  });
});
