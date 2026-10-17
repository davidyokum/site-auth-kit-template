/**
 * My account: email; passkeys (list, add, remove, never the last way in); authenticator (set up,
 * replace); password (change, or set one and then an authenticator); sign out everywhere.
 *
 * The server checks first (`requireUser` refuses a password user without an authenticator and the
 * page guard sends them to setup). `TOTPEnrollmentGate` is the screens' mirror of that rule, never
 * the enforcement: it always renders its children (on the server too), and with `serverChecked`
 * they show from the first paint, because the guard above has just checked. The browser re-checks,
 * and the gate switches to setup only if that says so (auth-kit ADR 0015). It sits here, inside the
 * page after its guard, as auth-kit's README places it, not around a layout's children.
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
      <TOTPEnrollmentGate issuer={site.name} serverChecked>
        <MyAccount issuer={site.name} passkeysEnabled={site.passkeys !== false} />
      </TOTPEnrollmentGate>
    </div>
  );
}
