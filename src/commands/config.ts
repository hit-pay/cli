import { Command } from 'commander';
import {
  ENVIRONMENT_NAMES,
  getApiBaseUrl,
} from '../lib/hitpay/environments.js';
import {
  getActiveEnvironment,
  getAuthMethod,
  getConfigPath,
  getConfigValue,
  getProfile,
  maskSecret,
  readConfig,
  resolveEnvironment,
  setGlobalValue,
  setProfileValue,
  unsetProfileValue,
  type GlobalConfigKey,
  type ProfileConfigKey,
} from '../lib/config.js';
import { getGlobalOpts } from '../lib/global-options.js';
import { verifyAndSaveApiKey } from '../lib/verify-api-key.js';
import * as output from '../lib/output.js';
import { handleError } from '../lib/errors.js';

const GLOBAL_KEYS: GlobalConfigKey[] = ['currency', 'country'];
const PROFILE_KEYS: ProfileConfigKey[] = ['api_key', 'salt'];
const ALL_KEYS = [...GLOBAL_KEYS, ...PROFILE_KEYS] as const;

function isGlobalKey(key: string): key is GlobalConfigKey {
  return (GLOBAL_KEYS as string[]).includes(key);
}

function isProfileKey(key: string): key is ProfileConfigKey {
  return (PROFILE_KEYS as string[]).includes(key);
}

function formatProfileForDisplay(
  env: string,
  profile: ReturnType<typeof getProfile>,
): Record<string, string> {
  const config = readConfig();
  const display: Record<string, string> = { environment: env };

  if (profile.api_key) display.api_key = maskSecret(profile.api_key);
  if (profile.salt) display.salt = maskSecret(profile.salt, 0, 4);
  if (profile.oauth) {
    display.oauth = 'connected';
    if (profile.oauth.business_id) display.business_id = profile.oauth.business_id;
  }

  const authMethod = getAuthMethod(profile);
  if (authMethod) display.auth_method = authMethod;

  display.api_url = getApiBaseUrl(env as ReturnType<typeof getActiveEnvironment>);

  if (env === getActiveEnvironment(config)) {
    display.active = 'true';
  }

  return display;
}

function resolveTargetEnvironment(cmd: Command): ReturnType<typeof getActiveEnvironment> {
  const config = readConfig();
  const globalOpts = getGlobalOpts(cmd);
  return resolveEnvironment(config, globalOpts.env);
}

export function registerConfig(program: Command): void {
  const config = program.command('config').description('Manage CLI configuration');

  config
    .command('set <key> <value>')
    .description(
      `Set a config value. Global: ${GLOBAL_KEYS.join(', ')}. Profile: ${PROFILE_KEYS.join(', ')}`,
    )
    .action(async (key: string, value: string, _, cmd) => {
      try {
        if (key === 'environment') {
          throw new Error(
            'Switch environment with `hitpay env use <env>` (local, staging, sandbox, production).',
          );
        }

        if (!ALL_KEYS.includes(key as (typeof ALL_KEYS)[number])) {
          throw new Error(`Invalid config key: ${key}. Valid keys: ${ALL_KEYS.join(', ')}`);
        }

        if (isGlobalKey(key)) {
          if (key === 'currency' || key === 'country') {
            setGlobalValue(key, value.toUpperCase());
          } else {
            setGlobalValue(key, value);
          }
          output.success(`Set ${key} = ${key === 'currency' || key === 'country' ? value.toUpperCase() : value}`);
          return;
        }

        const targetEnv = resolveTargetEnvironment(cmd);

        if (key === 'api_key') {
          await verifyAndSaveApiKey(targetEnv, value);
          output.success(`Set api_key for ${targetEnv}`);
          return;
        }

        setProfileValue(targetEnv, key as ProfileConfigKey, value);
        output.success(`Set ${key} for ${targetEnv}`);
      } catch (err) {
        handleError(err);
      }
    });

  config
    .command('unset <key>')
    .description(
      `Remove a config value. Profile keys (${PROFILE_KEYS.join(', ')}, oauth) respect --env`,
    )
    .action(async (key: string, _, cmd) => {
      try {
        if (key === 'oauth') {
          const targetEnv = resolveTargetEnvironment(cmd);
          unsetProfileValue(targetEnv, 'oauth');
          output.success(`Removed oauth for ${targetEnv}`);
          return;
        }

        if (!isProfileKey(key)) {
          throw new Error(
            `Invalid key: ${key}. Use profile keys: ${[...PROFILE_KEYS, 'oauth'].join(', ')}`,
          );
        }

        const targetEnv = resolveTargetEnvironment(cmd);
        unsetProfileValue(targetEnv, key);
        output.success(`Removed ${key} for ${targetEnv}`);
      } catch (err) {
        handleError(err);
      }
    });

  config
    .command('get <key>')
    .description('Get a config value (profile keys use active environment unless --env is set)')
    .action(async (key: string, _, cmd) => {
      try {
        if (
          !ALL_KEYS.includes(key as (typeof ALL_KEYS)[number]) &&
          key !== 'oauth' &&
          key !== 'environment'
        ) {
          throw new Error(`Invalid config key: ${key}. Valid keys: ${[...ALL_KEYS, 'oauth', 'environment'].join(', ')}`);
        }

        const targetEnv = resolveTargetEnvironment(cmd);

        if (key === 'environment') {
          console.log(getActiveEnvironment(readConfig()));
          return;
        }

        if (key === 'oauth') {
          const profile = getProfile(readConfig(), targetEnv);
          if (profile.oauth) {
            output.printData({
              environment: targetEnv,
              oauth: 'connected',
              business_id: profile.oauth.business_id,
            });
          } else {
            output.warn(`OAuth is not configured for ${targetEnv}`);
          }
          return;
        }

        const value = isProfileKey(key)
          ? getConfigValue(key, targetEnv)
          : getConfigValue(key);

        if (value === undefined) {
          output.warn(`Config key "${key}" is not set`);
          return;
        }

        if (key === 'api_key' || key === 'salt') {
          console.log(key === 'salt' ? maskSecret(value, 0, 4) : maskSecret(value));
          return;
        }

        console.log(value);
      } catch (err) {
        handleError(err);
      }
    });

  config
    .command('list')
    .description('Show configuration')
    .option('--all', 'Show all environment profiles')
    .action(async (opts) => {
      try {
        const cfg = readConfig();

        if (opts.all) {
          const profiles = cfg.profiles ?? {};
          const entries = ENVIRONMENT_NAMES.filter((name) => profiles[name]).map((name) =>
            formatProfileForDisplay(name, getProfile(cfg, name)),
          );

          output.printData({
            active_environment: getActiveEnvironment(cfg),
            currency: cfg.currency,
            country: cfg.country,
            profiles: entries,
            config_path: getConfigPath(),
          });
          return;
        }

        const env = getActiveEnvironment(cfg);
        const profile = getProfile(cfg, env);
        const display: Record<string, string> = {
          environment: env,
          config_path: getConfigPath(),
        };

        if (cfg.currency) display.currency = cfg.currency;
        if (cfg.country) display.country = cfg.country;

        Object.assign(display, formatProfileForDisplay(env, profile));

        output.printData(display);
      } catch (err) {
        handleError(err);
      }
    });
}
