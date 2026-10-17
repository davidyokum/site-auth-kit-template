/**
 * The members area. The layout checks, and so does every page under it: a layout alone isn't a
 * gate (it doesn't re-run on every navigation, and route handlers and server actions skip it).
 *
 * The authenticator rule is enforced here on the server: `requireUser()` refuses a password user
 * without an authenticator code, and the page guard sends them to /account/authenticator.
 *
 * auth-kit's client-side `TOTPEnrollmentGate` isn't wrapped around `children` here. The guard above
 * already refuses a password user without an authenticator on every page below, and the gate is
 * never a security boundary (React sends its children to the browser whatever it shows). It renders
 * its children on the server, so it would no longer mask a nested page's 404 (auth-kit ADR 0015),
 * but in a layout it would only hide every page until a browser round trip to Cognito. It lives on
 * /account instead, inside the page, after the server check.
 */
import type { ReactNode } from 'react';
import { pages } from '@/lib/auth';

export default async function MembersLayout({ children }: { children: ReactNode }) {
  await pages.requireUser();
  return children;
}
