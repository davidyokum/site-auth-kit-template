import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The auth matrix: starts `next dev` (test/matrix/global-setup.ts) and runs every route as every
// persona. Needs `next build` first, for the route manifest.
export default defineConfig({
  resolve: {
    alias: [{ find: /^@\//, replacement: `${fileURLToPath(new URL('.', import.meta.url))}` }],
  },
  test: {
    include: ['test/matrix/**/*.test.ts'],
    globalSetup: ['test/matrix/global-setup.ts'],
    environment: 'node',
    testTimeout: 240_000,
    hookTimeout: 240_000,
    fileParallelism: false,
  },
});
