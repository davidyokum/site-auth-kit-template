/**
 * DEV ONLY: the localhost kit (auth-kit/dev; 03 §2 "Local development"). Imported only by dev-only
 * files: app/api/dev/sign-in/route.dev.ts (a route only under `next dev`) and lib/dev/on.tsx (what
 * `@/dev` means under `next dev`). A build never sees it, and `npm run check:prod-build` proves it.
 *
 * "Sign in as…" signs a persona from personas.json in for real against your SANDBOX pool, with
 * `AdminInitiateAuth`, so every server check runs exactly as in production. It answers 404 unless:
 * NODE_ENV is development; the host is localhost/*.localhost/127.0.0.1; ALLOW_DEV_SIGNIN=1
 * (.env.local); no proxy headers name another machine; writes come from the page itself; the dev
 * server listens on loopback only; and the pool is tagged Environment=sandbox.
 */
import { createDevKit } from 'auth-kit/dev';
import personas from '@/personas.json';
import { outputs } from '@/lib/outputs';
import { refreshTokenMinutes } from '@/lib/session';
import { site } from '@/site.config';

export const devKit = createDevKit({
  outputs,
  personas,
  appRoles: site.appRoles,
  // Persona session cookies last as long as a real session would.
  cookieMaxAgeSeconds: refreshTokenMinutes * 60,
});
