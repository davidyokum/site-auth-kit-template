/**
 * The site's server auth: one pool, one app client, one capability map (auth-kit/server).
 *
 * Every route handler, server action, and data-loading server component calls one of these before
 * touching data. The proxy (proxy.ts) is a first checkpoint, never the only one:
 *
 * - route handlers and server actions: `auth.requireUser()`, `auth.requireCan('…')`
 *   (throw 401/403/404/503; wrap route handlers in `withAuthErrors`)
 * - pages and layouts: `pages.requireUser()`, `pages.requireCan('…')`
 *   (401 → sign-in redirect with a safe `next`; missing authenticator → setup page; 403/404 → not found)
 * - items: `auth.requireResourceRole('project', id, 'edit')` (`pages.requireResourceRole` on pages):
 *   their role on the item or their site role's floor; 404 for anyone who can't see it (lib/resources.ts)
 * - admin writes: `{ live: true }` re-reads status and groups from Cognito (~60 s cache), so a
 *   disabled or demoted admin loses the admin area at once; `recentSignIn: true` for risky actions.
 *
 * Imported by proxy.ts too, so it must stay free of React and of anything that needs a request.
 */
import { createPageGuards, createServerAuth, poolConfigFromAmplifyOutputs } from 'auth-kit/server';
import { matrixOverrides } from '@/dev-matrix';
import { capabilities } from './capabilities';
import { outputs } from './outputs';
import { resourceStore, resourceTypes } from './resources';

export const auth = createServerAuth({
  ...poolConfigFromAmplifyOutputs(outputs),
  capabilities,
  // Resource roles (Manager, Contributor, Reader on one project): lib/resources.ts.
  resources: { types: resourceTypes, store: resourceStore },
  // Only under `next dev` with AUTH_KIT_MATRIX=1 (the auth-matrix tests): auth-kit's matrix server
  // mode, which trusts the test issuer's keys (and fetches no others) and asks a scripted Cognito.
  // In every build `@/dev-matrix` is lib/dev/matrix.off.ts, which returns null, so production code
  // can't reach this. See lib/dev/README.md.
  ...matrixOverrides()?.serverAuth,
});

export const pages = createPageGuards(auth);
