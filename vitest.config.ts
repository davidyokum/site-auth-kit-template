import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { AWS_BLOCKED_ENV } from './test/aws-blocked-env.ts';

const root = fileURLToPath(new URL('.', import.meta.url));

// Unit tests. The auth matrix has its own config (vitest.matrix.config.ts): it needs a build.
export default defineConfig({
  resolve: {
    alias: [
      // The shapes every build uses (as in tsconfig.json): unit tests never load dev-only modules
      // through the aliases. Tests that check a dev module import it by path.
      { find: /^@\/dev$/, replacement: `${root}lib/dev/off.tsx` },
      { find: /^@\/dev-matrix$/, replacement: `${root}lib/dev/matrix.off.ts` },
      { find: /^@\//, replacement: root },
      // `server-only` throws outside React's server bundles; tests run server code directly.
      { find: /^server-only$/, replacement: `${root}test/unit/support/server-only.ts` },
    ],
  },
  test: {
    include: ['test/unit/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    // No AWS from tests: a call that slips past a mock fails at credential lookup.
    env: AWS_BLOCKED_ENV,
  },
});
