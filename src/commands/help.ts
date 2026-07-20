import { Command } from 'commander';
import chalk from 'chalk';
import { PUBLIC_ENVIRONMENT_NAMES } from '../lib/hitpay/environments.js';

const COMMAND_GROUPS: { title: string; commands: string[]; expanded?: boolean }[] = [
  {
    title: 'Authentication & configuration',
    commands: ['env', 'login', 'logout', 'whoami', 'config'],
    expanded: true,
  },
  {
    title: 'Account',
    commands: ['balance', 'account'],
  },
  {
    title: 'Payments',
    commands: ['payment', 'charge', 'refund', 'qr', 'methods'],
  },
  {
    title: 'Customers & billing',
    commands: ['customer', 'invoice', 'plan', 'subscription'],
  },
  {
    title: 'Payouts',
    commands: ['beneficiary', 'transfer'],
  },
  {
    title: 'Webhooks',
    commands: ['listen', 'trigger'],
  },
];

const AUTH_SIMPLE_COMMANDS = ['login', 'logout', 'whoami'] as const;

interface HelpBlock {
  name: string;
  description: string;
  usage: string[];
  notes?: string[];
}

function getAuthBlocks(): HelpBlock[] {
  const envList = PUBLIC_ENVIRONMENT_NAMES.join(' | ');

  return [
    {
      name: 'env',
      description: 'Show or switch active environment',
      usage: ['hitpay env', `hitpay env use <environment>    ${envList}`],
    },
    {
      name: 'config',
      description: 'Manage persistent settings (~/.hitpay/config.json)',
      usage: [
        'hitpay config set <key> <value>    api_key, salt, currency, country',
        'hitpay config get <key>            profile keys respect --env',
        'hitpay config unset <key>          api_key, salt, oauth',
        'hitpay config list [--all]',
      ],
      notes: [
        'environment is read-only — use `hitpay env use <env>` to switch',
        'profile keys target the active environment unless --env is set',
      ],
    },
  ];
}

function findCommand(root: Command, path: string[]): Command | undefined {
  let current: Command = root;
  for (const segment of path) {
    const next = current.commands.find((cmd) => cmd.name() === segment);
    if (!next) return undefined;
    current = next;
  }
  return current;
}

function printSimpleCommand(name: string, description: string, indent = '  '): void {
  console.log(`${indent}${chalk.green(name.padEnd(16))}${description}`);
}

function printHelpBlock(block: HelpBlock): void {
  console.log(`  ${chalk.green.bold(block.name)}`);
  console.log(`    ${block.description}`);
  console.log();

  for (const line of block.usage) {
    console.log(chalk.dim(`    ${line}`));
  }

  if (block.notes?.length) {
    console.log();
    for (const line of block.notes) {
      console.log(chalk.dim(`    ${line}`));
    }
  }

  console.log();
}

function printAuthGroup(program: Command): void {
  console.log(chalk.bold.cyan('Authentication & configuration'));
  console.log();

  const [envBlock, configBlock] = getAuthBlocks();

  printHelpBlock(envBlock);

  for (const name of AUTH_SIMPLE_COMMANDS) {
    const cmd = program.commands.find((c) => c.name() === name);
    if (cmd) printSimpleCommand(name, cmd.description());
  }

  console.log();
  printHelpBlock(configBlock);
}

function printOverview(program: Command): void {
  const version = program.version() || '';
  console.log(chalk.bold(`HitPay CLI${version ? ` v${version}` : ''}`));
  console.log(program.description());
  console.log();

  for (const group of COMMAND_GROUPS) {
    if (group.expanded) {
      printAuthGroup(program);
      continue;
    }

    console.log(chalk.bold.cyan(group.title));
    console.log();

    for (const name of group.commands) {
      const cmd = program.commands.find((c) => c.name() === name);
      if (!cmd) continue;
      printSimpleCommand(name, cmd.description());
    }

    console.log();
  }

  console.log(chalk.dim('Global options:'));
  console.log(chalk.dim('  --env (one-off) --json --api-key'));
  console.log();
  console.log(chalk.dim('Run `hitpay help <command>` for command details.'));
  console.log(chalk.dim('Run `hitpay <command> --help` for subcommands.'));
}

export function registerHelp(program: Command): void {
  program.addHelpCommand(false);

  program
    .command('help [command...]')
    .description('Show all commands or help for a specific command')
    .action((commandPath: string[]) => {
      if (commandPath.length > 0) {
        const target = findCommand(program, commandPath);
        if (!target) {
          console.error(chalk.red(`Unknown command: ${commandPath.join(' ')}`));
          console.error(chalk.dim('Run `hitpay help` to see all commands.'));
          process.exit(1);
        }
        target.outputHelp();
        return;
      }

      printOverview(program);
    });
}
