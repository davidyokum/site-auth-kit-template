/**
 * The first checkpoint, never the only one (03 §2 Enforcement; auth-kit/proxy).
 *
 * - **Default-deny.** Every path needs a verified session except the exact public paths in
 *   lib/public-routes.ts and `/sign-in`. A page or route someone forgets to list is still protected.
 * - **Verifies tokens** (signature, expiry, issuer, client, token use), not just that a cookie exists.
 *   Pages without a session get a 307 to /sign-in?next=…; /api/* and non-GET requests get 401 JSON.
 * - **Refreshes** a genuine, merely expired Amplify session server-side (rate-limited).
 * - **Never the only gate.** Every route handler, server action, and data-loading component calls
 *   requireUser/requireCan itself; the auth matrix's "without proxy" pass fails any that don't.
 * - **The per-request Content-Security-Policy** (lib/security-headers.ts), through auth-kit's
 *   `nonceCspHeaders`: a fresh nonce per request, the policy on the request (Next reads the nonce
 *   from it and stamps its own scripts; a client's own CSP request header is dropped) and on every
 *   response, redirects and refusals included, and the nonce in `x-nonce` for pages.
 */
import { amplifyAdapterRefresh, nonceCspHeaders, withAuthProxy } from 'auth-kit/proxy';
import { fetchAuthSession } from 'aws-amplify/auth/server';
import { runWithAmplifyServerContext } from '@/lib/amplify-server';
import { auth } from '@/lib/auth';
import { outputs } from '@/lib/outputs';
import { PUBLIC_ROUTES } from '@/lib/public-routes';
import { contentSecurityPolicy } from '@/lib/security-headers';

const dev = process.env.NODE_ENV === 'development';

export const proxy = withAuthProxy({
  auth,
  publicRoutes: PUBLIC_ROUTES,
  refresh: amplifyAdapterRefresh({ runWithAmplifyServerContext, fetchAuthSession }),
  headers: nonceCspHeaders((nonce) => contentSecurityPolicy({ nonce, dev, region: outputs.auth.aws_region })),
});

// Must be a literal: Next reads the matcher at build time.
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
