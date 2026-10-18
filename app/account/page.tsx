/**
 * My account: email; passkeys (list, add, remove, never the last way in); authenticator (set up,
 * replace); password (change, or set one and then an authenticator); sign out everywhere. On sign-up
 * sites (site.config.ts `accountCreation`: 'domains' or 'open'), members also change their own email
 * (a code to the new address; the old one keeps working until it's verified, and is told) and delete
 * their own account (a recent sign-in and the address typed out; never the owner).
 *
 * The server checks first (`requireUser` refuses a password user without an authenticator and the
 * page guard sends them to setup). `TOTPEnrollmentGate` is the screens' mirror of that rule, never
 * the enforcement: it always renders its children (on the server too), and with `serverChecked`
 * they show from the first paint, because the guard above has just checked. The browser re-checks,
 * and the gate switches to setup only if that says so (auth-kit ADR 0015). It sits here, inside the
 * page after its guard, as auth-kit's README places it, not around a layout's children.
 */
import { MyAccount, TOTPEnrollmentGate } from 'auth-kit/client';
import { signInUrl } from 'auth-kit/server';
import type { Metadata } from 'next';
import { takesSignUps } from '@/lib/account-modes';
import { pages } from '@/lib/auth';
import { site } from '@/site.config';
import { confirmEmailChange, deleteMyAccount, requestEmailChange } from './actions';

export const metadata: Metadata = { title: 'My account' };

export default async function AccountPage() {
  const user = await pages.requireUser();
  const selfService = takesSignUps(site.accountCreation) ? { requestEmailChange, confirmEmailChange, deleteMyAccount } : undefined;
  return (
    <div className="stack">
      <p className="muted small">Signed in as {user.profile?.email ?? user.username}.</p>
      <TOTPEnrollmentGate issuer={site.name} serverChecked>
        <MyAccount
          issuer={site.name}
          siteName={site.name}
          passkeysEnabled={site.passkeys !== false}
          signedOutPath="/signed-out"
          stepUpHref={signInUrl('/account', { reauth: true })}
          {...(selfService && { selfService, itemsNote: 'Your roles on projects are removed; the projects stay with their other Managers.' })}
        />
      </TOTPEnrollmentGate>
    </div>
  );
}
