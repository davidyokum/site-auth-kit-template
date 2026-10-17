/**
 * My account: email; passkeys (list, add, remove, never the last way in); authenticator (set up,
 * replace); password (change, or set one and then an authenticator); sign out everywhere.
 * The server checks first; auth-kit's `MyAccount` runs in the browser because passkeys need it.
 */
import { MyAccount } from 'auth-kit/client';
import type { Metadata } from 'next';
import { pages } from '@/lib/auth';
import { site } from '@/site.config';

export const metadata: Metadata = { title: 'My account' };

export default async function AccountPage() {
  const user = await pages.requireUser();
  return (
    <div className="stack">
      <p className="muted small">Signed in as {user.profile?.email ?? user.username}.</p>
      <MyAccount issuer={site.name} passkeysEnabled={site.passkeys !== false} />
    </div>
  );
}
