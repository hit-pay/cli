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

import { registerConfig } from '../../src/commands/config.js';
import * as output from '../../src/lib/output.js';
import {
  getConfigValue,
  readConfig,
  setGlobalValue,
  setProfileValue,
  unsetProfileValue,
  writeConfig,
} from '../../src/lib/config.js';
import { verifyAndSaveApiKey } from '../../src/lib/verify-api-key.js';
import { HitPayClient } from '../../src/lib/hitpay/client.js';

function createConfigProgram(): Command {
  const program = new Command();
  registerConfig(program);
  return program;
}

describe('config command helpers', () => {
  beforeEach(() => {
    configFsMock.fileContent = null;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('setGlobalValue handles currency and country (config set)', () => {
    writeConfig({ environment: 'sandbox', profiles: { sandbox: { api_key: 'sk-x' } } });
    setGlobalValue('currency', 'SGD');
    setGlobalValue('country', 'sg');

    const config = readConfig();
    expect(config.currency).toBe('SGD');
    expect(config.country).toBe('SG');
    expect(config.profiles?.sandbox?.api_key).toBe('sk-x');
  });

  it('verifyAndSaveApiKey stores key after verification (config set api_key)', async () => {
    vi.spyOn(HitPayClient.prototype, 'verifyConnection').mockResolvedValue(true);

    await verifyAndSaveApiKey('sandbox', 'sk-sandbox-key');

    expect(readConfig().profiles?.sandbox?.api_key).toBe('sk-sandbox-key');
  });

  it('setProfileValue stores profile keys (config set salt)', () => {
    writeConfig({ environment: 'local', profiles: {} });
    setProfileValue('local', 'salt', 'webhook-salt');

    const profile = readConfig().profiles?.local;
    expect(profile?.salt).toBe('webhook-salt');
  });

  it('unsetProfileValue clears profile keys (config unset)', () => {
    writeConfig({
      environment: 'sandbox',
      profiles: { sandbox: { api_key: 'sk-x', salt: 'webhook-salt' } },
    });

    unsetProfileValue('sandbox', 'salt');

    const profile = readConfig().profiles?.sandbox;
    expect(profile?.salt).toBeUndefined();
    expect(profile?.api_key).toBe('sk-x');
  });

  it('getConfigValue reads global and profile values (config get)', () => {
    writeConfig({
      environment: 'production',
      currency: 'SGD',
      profiles: { production: { api_key: 'sk-live' } },
    });

    expect(getConfigValue('environment')).toBe('production');
    expect(getConfigValue('currency')).toBe('SGD');
    expect(getConfigValue('api_key', 'production')).toBe('sk-live');
  });
});

describe('config command', () => {
  let successSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    configFsMock.fileContent = null;
    successSpy = vi.spyOn(output, 'success').mockImplementation(() => {});
    errorSpy = vi.spyOn(output, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects config set environment and directs to hitpay env use', async () => {
    await createConfigProgram().parseAsync([
      'node',
      'hitpay',
      'config',
      'set',
      'environment',
      'sandbox',
    ]);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Switch environment with `hitpay env use <env>`'),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(readConfig().environment).toBeUndefined();
  });

  it('config set currency normalizes to uppercase', async () => {
    writeConfig({ environment: 'production', profiles: {} });

    await createConfigProgram().parseAsync([
      'node',
      'hitpay',
      'config',
      'set',
      'currency',
      'sgd',
    ]);

    expect(readConfig().currency).toBe('SGD');
    expect(successSpy).toHaveBeenCalledWith('Set currency = SGD');
  });

  it('config get environment prints active environment', async () => {
    writeConfig({ environment: 'sandbox', profiles: {} });

    await createConfigProgram().parseAsync(['node', 'hitpay', 'config', 'get', 'environment']);

    expect(logSpy).toHaveBeenCalledWith('sandbox');
  });

  it('config get environment defaults to production when unset', async () => {
    await createConfigProgram().parseAsync(['node', 'hitpay', 'config', 'get', 'environment']);

    expect(logSpy).toHaveBeenCalledWith('production');
  });
});
