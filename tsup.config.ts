import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
  // Don't bundle npm dependencies — they'll be resolved from node_modules at runtime
  noExternal: [],
  external: [
    'chalk',
    'cli-table3',
    'commander',
    'inquirer',
    '@inquirer/prompts',
    'localtunnel',
    'ora',
    'qrcode-terminal',
  ],
});
