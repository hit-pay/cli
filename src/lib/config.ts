import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.hitpay');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export interface HitPayConfig {
  api_key?: string;
  salt?: string;
  environment?: 'sandbox' | 'production';
  currency?: string;
  country?: string;
}

const VALID_KEYS: (keyof HitPayConfig)[] = ['api_key', 'salt', 'environment', 'currency', 'country'];

function ensureDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function readConfig(): HitPayConfig {
  if (!existsSync(CONFIG_FILE)) {
    return {};
  }
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw) as HitPayConfig;
  } catch {
    return {};
  }
}

export function writeConfig(config: HitPayConfig): void {
  ensureDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
}

export function setConfigValue(key: string, value: string): void {
  if (!VALID_KEYS.includes(key as keyof HitPayConfig)) {
    throw new Error(`Invalid config key: ${key}. Valid keys: ${VALID_KEYS.join(', ')}`);
  }
  if (key === 'environment' && value !== 'sandbox' && value !== 'production') {
    throw new Error('Environment must be "sandbox" or "production"');
  }
  const config = readConfig();
  (config as Record<string, string>)[key] = value;
  writeConfig(config);
}

export function getConfigValue(key: string): string | undefined {
  const config = readConfig();
  return (config as Record<string, string | undefined>)[key];
}

export function clearConfig(): void {
  writeConfig({});
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}
