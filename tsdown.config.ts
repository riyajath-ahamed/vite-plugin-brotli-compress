import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
  },
  {
    entry: ['src/compression-worker.ts'],
    format: ['cjs', 'esm'],
    dts: false,
  },
]);
