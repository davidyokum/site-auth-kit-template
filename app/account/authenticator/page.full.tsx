/**
 * Authenticator setup: where password users without an authenticator code are sent (the page
 * guards' `mfaSetupPath`). The standard requires one of every password user; `requireUser` refuses
 * them everywhere else (403 `mfa_enrollment_required`), so this is the one page that lets them in.
 *
 * It's a sign-in screen, not a page of the site: auth-kit's card on the backdrop (`AuthScene`), with no
 * site header (globals.css hides it on every `AuthScene` page). The header's links would only lead back
 * here, and its "Sign in" would read as signed out. The card's own way out is "Sign out everywhere".
 *
 * Since auth-kit 0.1.20 nobody should land here halfway through a first sign-in: a first password is
 * saved only once the authenticator's code checks out. It's still where an account that has a password
 * without an authenticator (made before 0.1.20, or by an admin) finishes setting one up, and the setup
 * key it shows stays the same across reloads, so an entry scanned from it keeps working.
 */
import type { Metadata } from 'next';
import { AuthScene } from '@/components/auth-scene';
import { pages } from '@/lib/auth';
import { site } from '@/site.config';
import { AuthenticatorSetupPanel } from './setup-panel';

export const metadata: Metadata = { title: 'Set up your authenticator' };

export default async function AuthenticatorPage() {
  const user = await pages.requireUser({ allowMfaEnrollment: true });
  return (
    <AuthScene>
      <AuthenticatorSetupPanel issuer={site.name} accountName={user.profile?.email ?? null} />
    </AuthScene>
  );
}
