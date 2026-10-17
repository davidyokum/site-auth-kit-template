/**
 * My account: email; passkeys (list, add, remove, never the last way in); authenticator (set up,
 * replace); password (change, or set one and then an authenticator); sign out everywhere.
 *
 * The server checks first (`requireUser` refuses a password user without an authenticator and the
 * page guard sends them to setup). `TOTPEnrollmentGate` is the screens' mirror of that rule: it
 * shows only setup to such a person, and fails closed (with a retry) if the check can't run. It
 * sits inside this page, not in a layout, because it hides its children during server rendering.
 */
import { MyAccount, TOTPEnrollmentGate } from 'auth-kit/client';
import type { Metadata } from 'next';
import { pages } from '@/lib/auth';
import { site } from '@/site.config';

export const metadata: Metadata = { title: 'My account' };

export default async function AccountPage() {
  const user = await pages.requireUser();
  return (
    <div className="stack">
      <p className="muted small">Signed in as {user.profile?.email ?? user.username}.</p>
      <TOTPEnrollmentGate issuer={site.name}>
        <MyAccount issuer={site.name} passkeysEnabled={site.passkeys !== false} />
      </TOTPEnrollmentGate>
    </div>
  );
}
