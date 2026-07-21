#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packagePath = join(root, 'package.json');
const lockPath = join(root, 'package-lock.json');

const BUMP_LEVELS = new Set(['patch', 'minor', 'major']);

export function bumpVersion(current, level) {
  const match = current.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error(`Invalid version: ${current}`);
  }

  let major = Number(match[1]);
  let minor = Number(match[2]);
  let patch = Number(match[3]);

  if (level === 'patch') {
    patch += 1;
  } else if (level === 'minor') {
    minor += 1;
    patch = 0;
  } else if (level === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else {
    throw new Error(`Unknown bump level: ${level}`);
  }

  return `${major}.${minor}.${patch}`;
}

function readPackage() {
  return JSON.parse(readFileSync(packagePath, 'utf-8'));
}

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

function syncLockfileVersion(version) {
  if (!existsSync(lockPath)) {
    return;
  }

  const lock = JSON.parse(readFileSync(lockPath, 'utf-8'));
  lock.version = version;

  if (lock.packages?.['']) {
    lock.packages[''].version = version;
  }

  writeJson(lockPath, lock);
}

function setVersion(nextVersion) {
  const pkg = readPackage();
  const previous = pkg.version;
  pkg.version = nextVersion;
  writeJson(packagePath, pkg);
  syncLockfileVersion(nextVersion);

  console.log(`Version bumped: ${previous} → ${nextVersion}`);
  return nextVersion;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function bump(level) {
  if (!BUMP_LEVELS.has(level)) {
    throw new Error(`Bump level must be one of: ${[...BUMP_LEVELS].join(', ')}`);
  }

  const pkg = readPackage();
  const nextVersion = bumpVersion(pkg.version, level);
  setVersion(nextVersion);
  return nextVersion;
}

function publish() {
  run('npm', ['run', 'prepublishOnly']);
  run('npm', ['publish', '--access', 'public']);
  console.log(`Published ${readPackage().name}@${readPackage().version} to npm`);
}

function printHelp() {
  console.log(`Usage:
  node scripts/release.mjs bump patch|minor|major
  node scripts/release.mjs publish
  node scripts/release.mjs release patch|minor|major

npm scripts:
  npm run version:patch
  npm run version:minor
  npm run version:major
  npm run publish:npm
  npm run release:patch
`);
}

function main() {
  const [command, arg] = process.argv.slice(2);

  try {
    switch (command) {
      case 'bump':
      case 'version':
        bump(arg);
        break;
      case 'publish':
        publish();
        break;
      case 'release':
        bump(arg);
        publish();
        break;
      default:
        printHelp();
        process.exit(command ? 1 : 0);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
