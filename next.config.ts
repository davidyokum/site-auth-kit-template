import { DEV_ALIAS, DEV_MATRIX_ALIAS, withDevKit } from 'auth-kit/dev';
import type { NextConfig } from 'next';
import { accountCreationPageExtensions } from './lib/account-modes';
import { enforceBackdropLock } from './lib/backdrop';
import { staticSecurityHeaders } from './lib/security-headers';
import { assertSiteConfig } from './lib/site-checks';
import { site } from './site.config';

const config: NextConfig = {
  // The account-creation pages and routes exist only where site.config.ts's `accountCreation` takes
  // them: `*.signup.tsx` / `*.signup.ts` on sign-up sites, `*.request.tsx` / `*.request.ts` on request
  // sites (lib/account-modes.ts). Elsewhere those files aren't routes, so builds, the route manifest,
  // and the auth matrix don't have them.
  pageExtensions: ['tsx', 'ts', 'jsx', 'js', ...accountCreationPageExtensions(site.accountCreation)],
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
 * `npm run check:prod-build` proves a build contains none of it. The backdrop picker is dev-only the
 * same way: app/dev/backdrops/page.dev.tsx and app/api/dev/backdrop/route.dev.ts.
 */
const nextConfig = (phase: string) => {
  // site.config.ts must hold a help address, and what its account-creation mode needs (lib/site-checks.ts).
  assertSiteConfig(site);
  // A deploy build stops on a backdrop that isn't locked; other builds warn (lib/backdrop.ts).
  enforceBackdropLock(site, { phase, env: process.env });
  return withDevKit(phase, config, { aliases: [DEV_ALIAS, DEV_MATRIX_ALIAS] });
};

export default nextConfig;
