/**
 * The exact paths anyone may load without signing in (proxy.ts). Everything else is default-deny.
 * `/sign-in` is always public (auth-kit adds it). Add sparingly, never a catch-all (auth-kit refuses
 * those at startup), and give every public page a matrix row that says so (test/matrix).
 *
 * - `/signed-out`: where "Sign out everywhere" lands; the same page for everybody.
 * - The account-creation pages and routes, only on sites whose `accountCreation` mode has them
 *   (lib/account-modes.ts): `/sign-up` and `POST /api/auth/sign-up` on sign-up sites,
 *   `/request-access` and `POST /api/auth/request-access` on request sites. They're public by design:
 *   the routes answer every address alike, rate-limit, and check the origin themselves.
 * - `/api/dev/sign-in` is listed in every environment, as auth-kit's localhost kit requires: under
 *   `next dev` the route runs its own gates; in a build it doesn't exist, so the answer is Next's 404
 *   (a 401 from the proxy would hide that). `npm run check:prod-build` proves it's absent. The
 *   backdrop picker's page and write route (`/dev/backdrops`, `/api/dev/backdrop`) are the same:
 *   dev-only files with their own gates, absent from every build.
 */
import { site } from '@/site.config';
import { takesRequests, takesSignUps } from './account-modes';

const SIGN_UP = takesSignUps(site.accountCreation);
const REQUESTS = takesRequests(site.accountCreation);

export const PUBLIC_ROUTES: readonly string[] = [
  '/',
  '/signed-out',
  ...(SIGN_UP ? ['/sign-up', '/api/auth/sign-up'] : []),
  ...(REQUESTS ? ['/request-access', '/api/auth/request-access'] : []),
  '/api/dev/sign-in',
  '/dev/backdrops',
  '/api/dev/backdrop',
];

/** Pages that render for anonymous visitors (they call no guard, or only `getUser` for display). */
export const PUBLIC_PAGES: readonly string[] = ['/', '/sign-in', '/signed-out', ...(SIGN_UP ? ['/sign-up'] : []), ...(REQUESTS ? ['/request-access'] : [])];

/** Public routes that change data on purpose: the account-creation routes (each checks the origin itself). */
export const PUBLIC_ACCOUNT_ROUTES: readonly string[] = [...(SIGN_UP ? ['/api/auth/sign-up'] : []), ...(REQUESTS ? ['/api/auth/request-access'] : [])];
