import { withDevKit } from 'auth-kit/dev';
import type { NextConfig } from 'next';
import { staticSecurityHeaders } from './lib/security-headers';

const config: NextConfig = {
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
 * - `@/dev-matrix` likewise: lib/dev/matrix.on.ts (the auth-matrix test server) or matrix.off.ts.
 * `npm run check:prod-build` proves a build contains none of it.
 */
export default (phase: string) =>
  withDevKit(phase, withDevKit(phase, config), {
    alias: '@/dev-matrix',
    on: './lib/dev/matrix.on.ts',
    off: './lib/dev/matrix.off.ts',
  });
