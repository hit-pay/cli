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

import { registerLogin } from '../../src/commands/login.js';
import * as output from '../../src/lib/output.js';

function createLoginProgram(): Command {
  const program = new Command();
  program.option('--env <environment>', 'One-off profile override');
  registerLogin(program);
  return program;
}

describe('hitpay login command', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    configFsMock.fileContent = null;
    errorSpy = vi.spyOn(output, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects --env and directs to hitpay env use', async () => {
    await createLoginProgram().parseAsync(['node', 'hitpay', '--env', 'sandbox', 'login']);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Switch environment first with `hitpay env use <env>`'),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
