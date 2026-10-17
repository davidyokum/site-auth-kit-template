/**
 * The members area. The layout checks, and so does every page under it: a layout alone isn't a
 * gate (it doesn't re-run on every navigation, and route handlers and server actions skip it).
 *
 * The authenticator rule is enforced here on the server: `requireUser()` refuses a password user
 * without an authenticator code, and the page guard sends them to /account/authenticator.
 *
 * auth-kit's client-side `TOTPEnrollmentGate` is deliberately NOT wrapped around `children` here:
 * it renders only "Checking your account…" during server rendering, so in a layout it would hide
 * every page's content until a browser-side Cognito call returns, and it swallows nested pages'
 * status codes (a record page's 404 would go out as 200; the auth matrix catches that). The gate
 * lives on /account instead, inside the page, after the server check.
 */
import type { ReactNode } from 'react';
import { pages } from '@/lib/auth';

export default async function MembersLayout({ children }: { children: ReactNode }) {
  await pages.requireUser();
  return children;
}
