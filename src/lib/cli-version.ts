import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLI_PACKAGE_NAME } from './package-meta.js';

export { CLI_PACKAGE_NAME };

function readPackageVersion(): string {
  let dir = dirname(fileURLToPath(import.meta.url));

  while (true) {
    const manifestPath = join(dir, 'package.json');
    if (existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
          name?: string;
          version?: string;
        };
        if (manifest.name === CLI_PACKAGE_NAME && manifest.version) {
          return manifest.version;
        }
      } catch {
        // Keep searching parent directories.
      }
    }

    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  throw new Error('Could not find package version');
}

const NPM_REGISTRY_URL = `https://registry.npmjs.org/${encodeURIComponent(CLI_PACKAGE_NAME)}/latest`;

export function getCurrentVersion(): string {
  return readPackageVersion();
}

export function compareVersions(a: string, b: string): number {
  const parse = (value: string): [number, number, number] => {
    const match = value.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) {
      throw new Error(`Invalid version: ${value}`);
    }
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  };

  const left = parse(a);
  const right = parse(b);

  for (let i = 0; i < 3; i++) {
    if (left[i] > right[i]) return 1;
    if (left[i] < right[i]) return -1;
  }

  return 0;
}

export function isNewerVersion(latest: string, current: string): boolean {
  return compareVersions(latest, current) > 0;
}

export async function fetchLatestVersion(): Promise<string> {
  const response = await fetch(NPM_REGISTRY_URL);

  if (!response.ok) {
    throw new Error(`Failed to check latest version (HTTP ${response.status})`);
  }

  const data = (await response.json()) as { version?: string };

  if (!data.version) {
    throw new Error('Latest version not found in npm registry response');
  }

  return data.version;
}

export function runNpmGlobalInstall(version: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = ['install', '-g', `${CLI_PACKAGE_NAME}@${version}`];
    const child = spawn('npm', args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to run npm: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `npm install failed with exit code ${code}. Try running manually: npm install -g ${CLI_PACKAGE_NAME}@${version}`,
        ),
      );
    });
  });
}
