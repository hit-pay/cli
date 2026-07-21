import type { Command } from 'commander';

export interface GlobalCliOptions {
  json?: boolean;
  env?: string;
  apiKey?: string;
}

export function getRootCommand(cmd: Command): Command {
  let root = cmd;
  while (root.parent) {
    root = root.parent;
  }
  return root;
}

export function getGlobalOpts(cmd: Command): GlobalCliOptions {
  return getRootCommand(cmd).opts() as GlobalCliOptions;
}
