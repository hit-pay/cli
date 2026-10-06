import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import {
  type Environment,
  type EnvironmentProfile,
  type OAuthCredentials,
  ENVIRONMENT_NAMES,
  isEnvironment,
} from './hitpay/environments.js';

const CONFIG_DIR = join(homedir(), '.hitpay');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export type { Environment, EnvironmentProfile, OAuthCredentials };

export interface HitPayConfig {
  environment?: Environment;
  currency?: string;
  country?: string;
  profiles?: Partial<Record<Environment, EnvironmentProfile>>;
  /** @deprecated Migrated into profiles on read */
  api_key?: string;
  /** @deprecated Migrated into profiles on read */
  salt?: string;
}

const GLOBAL_KEYS = ['environment', 'currency', 'country'] as const;
const PROFILE_KEYS = ['api_key', 'salt'] as const;

export type GlobalConfigKey = (typeof GLOBAL_KEYS)[number];
export type ProfileConfigKey = (typeof PROFILE_KEYS)[number];

function ensureDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/** Migrate legacy flat config (root api_key) into per-environment profiles. */
export function migrateConfig(raw: HitPayConfig): HitPayConfig {
  if (raw.profiles) {
    return raw;
  }

  const env = raw.environment ?? 'production';
  const profile: EnvironmentProfile = {};

  if (raw.api_key) profile.api_key = raw.api_key;
  if (raw.salt) profile.salt = raw.salt;

  const migrated: HitPayConfig = {
    environment: raw.environment,
    currency: raw.currency,
    country: raw.country,
    profiles: Object.keys(profile).length > 0 ? { [env]: profile } : {},
  };

  return migrated;
}

/** Remove deprecated profile fields from stored config. */
function stripDeprecatedProfileFields(config: HitPayConfig): HitPayConfig {
  if (!config.profiles) return config;

  for (const env of ENVIRONMENT_NAMES) {
    const profile = config.profiles[env];
    if (profile && 'api_url' in profile) {
      delete (profile as { api_url?: string }).api_url;
    }
  }

  return config;
}

export function readConfig(): HitPayConfig {
  if (!existsSync(CONFIG_FILE)) {
    return {};
  }
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as HitPayConfig;
    return stripDeprecatedProfileFields(migrateConfig(parsed));
  } catch {
    return {};
  }
}

export function writeConfig(config: HitPayConfig): void {
  ensureDir();
  const clean = { ...config };
  delete clean.api_key;
  delete clean.salt;
  writeFileSync(CONFIG_FILE, JSON.stringify(clean, null, 2) + '\n', { mode: 0o600 });
}

export function resolveEnvironment(config: HitPayConfig, override?: string): Environment {
  const candidate = override ?? config.environment ?? 'production';
  if (!isEnvironment(candidate)) {
    throw new Error(
      `Invalid environment: ${candidate}. Valid values: ${ENVIRONMENT_NAMES.join(', ')}`,
    );
  }
  return candidate;
}

export function getProfile(config: HitPayConfig, env: Environment): EnvironmentProfile {
  return config.profiles?.[env] ?? {};
}

export function getActiveEnvironment(config: HitPayConfig): Environment {
  return resolveEnvironment(config);
}

export function ensureProfile(config: HitPayConfig, env: Environment): HitPayConfig {
  const next = { ...config, profiles: { ...config.profiles } };
  if (!next.profiles![env]) {
    next.profiles![env] = {};
  }
  return next;
}

export function setGlobalValue(key: GlobalConfigKey, value: string): void {
  if (!GLOBAL_KEYS.includes(key)) {
    throw new Error(`Invalid config key: ${key}`);
  }
  if (key === 'environment' && !isEnvironment(value)) {
    throw new Error(`Environment must be one of: ${ENVIRONMENT_NAMES.join(', ')}`);
  }

  const normalized =
    key === 'currency' || key === 'country' ? value.toUpperCase() : value;

  const config = readConfig();
  (config as Record<string, string>)[key] = normalized;
  writeConfig(config);
}

export function setProfileValue(env: Environment, key: ProfileConfigKey, value: string): void {
  if (!PROFILE_KEYS.includes(key)) {
    throw new Error(`Invalid profile key: ${key}`);
  }

  let config = readConfig();
  config = ensureProfile(config, env);
  config.profiles![env]![key] = value;
  writeConfig(config);
}

export function setProfileOAuth(env: Environment, oauth: OAuthCredentials): void {
  let config = readConfig();
  config = ensureProfile(config, env);
  config.profiles![env]!.oauth = oauth;
  if (!config.environment) {
    config.environment = env;
  }
  writeConfig(config);
}

export function unsetProfileValue(env: Environment, key: ProfileConfigKey | 'oauth'): void {
  let config = readConfig();
  const profile = config.profiles?.[env];
  if (!profile) return;

  delete profile[key];
  if (Object.keys(profile).length === 0) {
    delete config.profiles![env];
  }
  writeConfig(config);
}

export function clearProfileAuth(env: Environment, all = false): void {
  let config = readConfig();
  const profile = config.profiles?.[env];
  if (!profile) return;

  delete profile.oauth;
  if (all) {
    delete profile.api_key;
    delete profile.salt;
  }

  if (Object.keys(profile).length === 0) {
    delete config.profiles![env];
  }
  writeConfig(config);
}

export function getConfigValue(key: string, env?: Environment): string | undefined {
  const config = readConfig();
  if (GLOBAL_KEYS.includes(key as GlobalConfigKey)) {
    return (config as Record<string, string | undefined>)[key];
  }
  if (PROFILE_KEYS.includes(key as ProfileConfigKey)) {
    const targetEnv = env ?? getActiveEnvironment(config);
    return getProfile(config, targetEnv)[key as ProfileConfigKey];
  }
  return undefined;
}

export function getAuthMethod(profile: EnvironmentProfile): 'api_key' | 'oauth' | null {
  if (profile.api_key) return 'api_key';
  if (profile.oauth?.access_token) return 'oauth';
  return null;
}

export function maskSecret(value: string, visibleStart = 8, visibleEnd = 4): string {
  if (value.length <= visibleStart + visibleEnd) {
    return '*'.repeat(value.length);
  }
  return value.slice(0, visibleStart) + '...' + value.slice(-visibleEnd);
}

export function clearConfig(): void {
  writeConfig({});
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

/** @deprecated Use setGlobalValue / setProfileValue */
export function setConfigValue(key: string, value: string): void {
  if (GLOBAL_KEYS.includes(key as GlobalConfigKey)) {
    setGlobalValue(key as GlobalConfigKey, value);
    return;
  }
  if (PROFILE_KEYS.includes(key as ProfileConfigKey)) {
    const config = readConfig();
    setProfileValue(getActiveEnvironment(config), key as ProfileConfigKey, value);
    return;
  }
  throw new Error(
    `Invalid config key: ${key}. Valid keys: ${[...GLOBAL_KEYS, ...PROFILE_KEYS].join(', ')}`,
  );
}

export function migrateConfigForTest(raw: HitPayConfig): HitPayConfig {
  return migrateConfig(raw);
}
