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
 * - Sets the per-request Content-Security-Policy with a fresh nonce (lib/security-headers.ts).
 */
import { amplifyAdapterRefresh, withAuthProxy } from 'auth-kit/proxy';
import { fetchAuthSession } from 'aws-amplify/auth/server';
import { NextRequest, type NextResponse } from 'next/server';
import { runWithAmplifyServerContext } from '@/lib/amplify-server';
import { auth } from '@/lib/auth';
import { outputs } from '@/lib/outputs';
import { PUBLIC_ROUTES } from '@/lib/public-routes';
import { contentSecurityPolicy, newNonce } from '@/lib/security-headers';

const authProxy = withAuthProxy({
  auth,
  publicRoutes: PUBLIC_ROUTES,
  refresh: amplifyAdapterRefresh({ runWithAmplifyServerContext, fetchAuthSession }),
});

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const nonce = newNonce();
  const csp = contentSecurityPolicy({ nonce, dev: process.env.NODE_ENV === 'development', region: outputs.auth.aws_region });

  // Next.js reads the nonce from the request's CSP header while rendering. withAuthProxy forwards the
  // request headers it's given, so it gets a header-only copy of the request carrying the policy
  // (always overwriting anything a client sent). It never reads the body; the route still receives
  // the original request's body.
  const headers = new Headers(request.headers);
  headers.set('content-security-policy', csp);
  headers.set('x-nonce', nonce);
  const response = await authProxy(new NextRequest(request.url, { method: request.method, headers }));

  response.headers.set('Content-Security-Policy', csp);
  return response;
}

// Must be a literal: Next reads the matcher at build time.
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
