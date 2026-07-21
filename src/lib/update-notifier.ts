import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Command } from 'commander';
import { fetchLatestVersion, getCurrentVersion, isNewerVersion } from './cli-version.js';
import { getGlobalOpts } from './global-options.js';
import * as output from './output.js';

const CACHE_DIR = join(homedir(), '.hitpay');
const CACHE_FILE = join(CACHE_DIR, 'update-check.json');
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

const SKIP_COMMANDS = new Set(['upgrade', 'version']);

interface UpdateCheckCache {
  checked_at: number;
  latest: string;
  update_available: boolean;
}

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function readCache(): UpdateCheckCache | null {
  if (!existsSync(CACHE_FILE)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) as UpdateCheckCache;
  } catch {
    return null;
  }
}

function writeCache(cache: UpdateCheckCache): void {
  ensureCacheDir();
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
}

function getTopLevelCommandName(cmd: Command): string | undefined {
  let current: Command = cmd;
  while (current.parent?.parent) {
    current = current.parent;
  }
  return current.name() || undefined;
}

function shouldSkipUpdateCheck(cmd: Command): boolean {
  const argv = process.argv;

  if (argv.includes('-V') || argv.includes('--version')) {
    return true;
  }

  if (getGlobalOpts(cmd).json) {
    return true;
  }

  const commandName = getTopLevelCommandName(cmd);
  return commandName !== undefined && SKIP_COMMANDS.has(commandName);
}

function notifyIfUpdateAvailable(latest: string, current: string): void {
  if (!isNewerVersion(latest, current)) {
    return;
  }

  output.warn(
    `A new version of HitPay CLI is available (${latest}). Run \`hitpay upgrade\` to update.`,
  );
}

export async function maybeNotifyUpdate(actionCommand: Command): Promise<void> {
  if (shouldSkipUpdateCheck(actionCommand)) {
    return;
  }

  const current = getCurrentVersion();
  const cached = readCache();
  const now = Date.now();

  if (cached && now - cached.checked_at < CHECK_INTERVAL_MS) {
    if (cached.update_available) {
      notifyIfUpdateAvailable(cached.latest, current);
    }
    return;
  }

  try {
    const latest = await fetchLatestVersion();
    const updateAvailable = isNewerVersion(latest, current);

    writeCache({
      checked_at: now,
      latest,
      update_available: updateAvailable,
    });

    if (updateAvailable) {
      notifyIfUpdateAvailable(latest, current);
    }
  } catch {
    // Ignore network/registry errors for passive update checks.
  }
}
