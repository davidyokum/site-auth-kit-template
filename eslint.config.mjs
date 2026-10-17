import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Stored content is rendered as text; raw HTML from data is how a script gets into a page
      // that reads the session tokens (03 §2 Admin area: no raw HTML fields).
      'react/no-danger': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'auth-kit/dev', message: 'Dev-only: import it only from lib/dev/kit.ts, lib/dev/*.on.ts(x), or *.dev.ts routes.' },
            { name: 'auth-kit/dev/menu', message: 'Dev-only: import it only from lib/dev/on.tsx.' },
            { name: 'auth-kit/testing', message: 'Test-only: never import it from app code.' },
          ],
          patterns: [{ group: ['@/lib/dev/*'], message: 'Use the @/dev or @/dev-matrix alias: it resolves to the off module in builds.' }],
        },
      ],
    },
  },
  {
    // The places dev-only and test-only code is allowed.
    files: ['lib/dev/**', 'app/**/*.dev.ts', 'test/**', 'next.config.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  globalIgnores(['.next/**', '.next-matrix/**', 'out/**', 'build/**', 'next-env.d.ts', '.amplify/**', 'coverage/**']),
]);
