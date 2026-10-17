/**
 * The members area. The layout checks, and so does every page under it: a layout alone isn't a
 * gate (it doesn't re-run on every navigation, and route handlers and server actions skip it).
 *
 * `TOTPEnrollmentGate` keeps the screens in step with the server's rule: a password user without an
 * authenticator sees only the setup steps. The server already refuses them (`requireUser`).
 */
import { TOTPEnrollmentGate } from 'auth-kit/client';
import type { ReactNode } from 'react';
import { pages } from '@/lib/auth';
import { site } from '@/site.config';

export default async function MembersLayout({ children }: { children: ReactNode }) {
  await pages.requireUser();
  return <TOTPEnrollmentGate issuer={site.name}>{children}</TOTPEnrollmentGate>;
}
