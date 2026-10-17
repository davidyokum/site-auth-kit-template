import { DEV_ALIAS, DEV_MATRIX_ALIAS, withDevKit } from 'auth-kit/dev';
import type { NextConfig } from 'next';
import { staticSecurityHeaders } from './lib/security-headers';

const config: NextConfig = {
  // The auth-matrix tests run their own `next dev` in .next-matrix, so a dev server you have open
  // keeps its own output. Builds always use .next (what `auth-kit check-prod-build` scans).
  distDir: process.env.SITE_NEXT_DIST_DIR === '.next-matrix' ? '.next-matrix' : '.next',
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    // Static security headers and a nonce-free baseline CSP on every response; proxy.ts adds the
    // full per-request CSP with a nonce (lib/security-headers.ts explains the split).
    return [{ source: '/:path*', headers: staticSecurityHeaders({ dev: process.env.NODE_ENV === 'development' }) }];
  },
};

/**
 * The localhost kit stays out of every build (auth-kit/dev, `withDevKit`):
 * - files ending in `.dev.ts` are routes only under `next dev` (app/api/dev/sign-in/route.dev.ts);
 * - `@/dev` resolves to lib/dev/on.tsx under `next dev`, and to lib/dev/off.tsx in every build;
 * - `@/dev-matrix` likewise: lib/dev/matrix.on.ts (auth-kit's matrix server mode) or matrix.off.ts.
 * auth-kit's DEV_ALIAS and DEV_MATRIX_ALIAS name exactly these files. tsconfig.json's `paths` point
 * both aliases at the off modules, so type checks see what builds get.
 * `npm run check:prod-build` proves a build contains none of it.
 */
const nextConfig = (phase: string) => withDevKit(phase, config, { aliases: [DEV_ALIAS, DEV_MATRIX_ALIAS] });

export default nextConfig;
